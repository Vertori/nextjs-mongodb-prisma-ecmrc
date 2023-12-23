"use server";

import { createCart, getCart } from "@/lib/db/cart";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";

export async function setProductQuantity(productId: string, quantity: number) {
  // execute createCart() if getCart() returns null or undefined
  const cart = (await getCart()) ?? (await createCart());

  // checking if product is already in cart
  const articleInCart = cart.items.find((item) => item.productId === productId);

  if (quantity === 0) {
    //if product is in cart and its quantity is equal to zero, delete it from db
    if (articleInCart) {
      await prisma.cart.update({
        where: { id: cart.id },
        data: {
          items: {
            delete: { id: articleInCart?.id },
          },
        },
      });
    }
  } else {
    //if quantity is different than zero
    if (articleInCart) {
      //if product is in cart, set its quantity in db to passed quantity
      await prisma.cart.update({
        where: { id: cart.id },
        data: {
          items: {
            update: {
              where: { id: articleInCart.id },
              data: { quantity },
            },
          },
        },
      });
    } else {
      //if product is not in cart, create new product in db with passed quantity
      await prisma.cart.update({
        where: { id: cart.id },
        data: {
          items: {
            create: {
              productId,
              quantity,
            },
          },
        },
      });
    }
  }
  revalidatePath("/cart"); //updating page to display the latest data
}
