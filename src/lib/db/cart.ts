import { Cart, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { cookies } from "next/dist/client/components/headers";

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
  const localCartId = cookies().get("localCartId")?.value;
  const cart = localCartId
    ? await prisma.cart.findUnique({
        where: { id: localCartId },
        include: { items: { include: { product: true } } },
      })
    : null;

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
  const newCart = await prisma.cart.create({
    data: {},
  });

  // set cookies to remember cart of users who are not logged in
  cookies().set("localCartId", newCart.id);

  return {
    ...newCart,
    items: [],
    size: 0,
    subtotal: 0,
  };
}
