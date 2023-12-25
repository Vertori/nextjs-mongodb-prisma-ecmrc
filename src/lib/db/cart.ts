import { Cart, CartItem, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { cookies } from "next/dist/client/components/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/auth";

export type CartWithProducts = Prisma.CartGetPayload<{
  include: { items: { include: { product: true } } };
}>;

export type CartItemWithProduct = Prisma.CartItemGetPayload<{
  include: { product: true };
}>;

// using CartWithProducts type instead of Cart type because Cart type from prisma schema contains only the data from the cart model, it doesn't contain cart item or product information
// thanks to that, this type can have the same structure as object returned from getCart()
export type ShoppingCart = CartWithProducts & {
  size: number;
  subtotal: number;
};

// fetch cart with its id, put cart information in there, put product information into the cart items to have all the latest product information in the cart
export async function getCart(): Promise<ShoppingCart | null> {
  const session = await getServerSession(authOptions);

  let cart: CartWithProducts | null = null;

  if (session) {
    // if user is logged in
    cart = await prisma.cart.findFirst({
      where: { userId: session.user.id },
      include: { items: { include: { product: true } } },
    });
  } else {
    // if user is not logged in
    const localCartId = cookies().get("localCartId")?.value;
    cart = localCartId
      ? await prisma.cart.findUnique({
          where: { id: localCartId },
          include: { items: { include: { product: true } } },
        })
      : null;
  }

  if (!cart) {
    return null;
  }

  //return cart with items in cart quantity and cart subtotal
  return {
    ...cart,
    size: cart.items.reduce(
      (accumulator, item) => accumulator + item.quantity,
      0
    ),
    subtotal: cart.items.reduce(
      (accumulator, item) => accumulator + item.quantity * item.product.price,
      0
    ),
  };
}

export async function createCart(): Promise<ShoppingCart> {
  const session = await getServerSession(authOptions);

  let newCart: Cart;

  if (session) {
    // if user is logged in, create cart connected to this user
    newCart = await prisma.cart.create({
      data: { userId: session.user.id },
    });
  } else {
    // if user is not logged in, create anonymous cart

    newCart = await prisma.cart.create({
      data: {},
    });

    // set cookies to remember cart of users who are not logged in
    cookies().set("localCartId", newCart.id);
  }

  return {
    ...newCart,
    items: [],
    size: 0,
    subtotal: 0,
  };
}

export async function mergeAnonymousCartIntoUserCart(userId: string) {
  const localCartId = cookies().get("localCartId")?.value; // fetch local cart from cookie

  const localCart = localCartId
    ? await prisma.cart.findUnique({
        where: { id: localCartId },
        include: { items: true },
      })
    : null;

  if (!localCart) return; // return if there is no local cart in cookies

  const userCart = await prisma.cart.findFirst({
    // if there is a local cart, fetch user cart from db
    where: { userId },
    include: { items: true },
  });

  await prisma.$transaction(async (tx) => {
    if (userCart) {
      // if there is local cart and user cart in db, merge those carts
      const mergedCartItems = mergeCartItems(localCart.items, userCart.items);
      await tx.cartItem.deleteMany({
        where: { cartId: userCart.id },
      });

      await tx.cart.update({
        where: { id: userCart.id },
        data: {
          items: {
            createMany: {
              data: mergedCartItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
              })),
            },
          },
        },
      });
    } else {
      // if there is no user cart in db, create a new one with items from local cookies cart
      await tx.cart.create({
        data: {
          userId,
          items: {
            createMany: {
              data: localCart.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
              })),
            },
          },
        },
      });
    }
    await tx.cart.delete({
      //delete cookie cart after merging
      where: { id: localCart.id },
    });
    cookies().set("localCartId", "");
  });
}

function mergeCartItems(...cartItems: CartItem[][]) {
  return cartItems.reduce((acc, items) => {
    items.forEach((item) => {
      const existingItem = acc.find((i) => i.productId === item.productId);
      if (existingItem) {
        existingItem.quantity += item.quantity;
      } else {
        acc.push(item);
      }
    });
    return acc;
  }, [] as CartItem[]);
}
