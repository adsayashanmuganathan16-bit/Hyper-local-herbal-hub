import React from 'react';
import { NavLink } from 'react-router-dom';

export default function SellerNavbar() {
  return <nav className="seller-navbar" aria-label="Seller navigation">
    <NavLink to="/seller" end>Dashboard</NavLink>
    <NavLink to="/seller/products">Products</NavLink>
    <NavLink to="/seller/products/new">Add product</NavLink>
    <NavLink to="/seller/orders">Orders</NavLink>
    <NavLink to="/seller/customers">Customers</NavLink>
    <NavLink to="/seller/earnings">Earnings</NavLink>
  </nav>;
}
