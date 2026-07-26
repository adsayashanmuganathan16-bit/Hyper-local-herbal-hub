import React from 'react';
import { Link } from 'react-router-dom';

export default function SellerAddProduct() {
  return <div className="seller-add-product"><h1>Add Product</h1><p>Use product management to add a medicine to your store.</p><Link className="btn btn-primary" to="/seller/products">Open product manager</Link></div>;
}
