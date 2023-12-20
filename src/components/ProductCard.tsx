import { Product } from "@prisma/client";
import Link from "next/link";
import React from "react";
import PriceTag from "./PriceTag";
import Image from "next/image";

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const isNew =
    Date.now() - new Date(product.createdAt).getTime() < 1000 * 60 * 60 * 24 * 5; //is new if is added less than 5 days ago
  return (
    <Link
      href={`/products/${product.id}`}
      className="card w-full bg-base-100 hover:shadow-xl transition-shadow"
    >
      <figure>
        <Image
          src={product.imageUrl}
          alt={product.name}
          height={400}
          width={800}
          className="h-48 object-cover"
        />
      </figure>
      <div className="card-body">
        <h2 className="card-title ">{product.name}</h2>
        {isNew && <div className="badge badge-secondary">NEW </div>}
        <p>{product.description}</p>
        <PriceTag price={product.price} />
      </div>
    </Link>
  );
};

export default ProductCard;
