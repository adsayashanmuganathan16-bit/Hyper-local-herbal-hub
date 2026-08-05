import React from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

// Component & page styles (plain global stylesheets)
import './components/Navbar.css';
import './components/Footer.css';
import './components/Loading.css';
import './components/MedicineCard.css';
import './components/SearchBar.css';
import './components/CartItem.css';
import './components/OrderCard.css';
import './components/PostalShipping.css';
import './pages/Home.css';
import './pages/Login.css';
import './pages/Shop.css';
import './pages/MedicineDetail.css';
import './pages/Cart.css';
import './pages/Checkout.css';
import './pages/OrderTracking.css';
import './pages/Prescription.css';
import './pages/Profile.css';
import './pages/Reviews.css';
import './pages/IdentifyPlant.css';
import './pages/SupportPages.css';
import './pages/admin/Dashboard.css';
import './pages/admin/Analytics.css';
import './pages/admin/NewsletterSubscribers.css';
import './pages/admin/SupportInbox.css';
import './styles/enhance.css';
import './styles/premium-system.css';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import SellerRegister from './pages/SellerRegister';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import Shop from './pages/Shop';
import MedicineDetail from './pages/MedicineDetail';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import Checkout from './pages/Checkout';
import DemoPayment from './pages/DemoPayment';
import Orders from './pages/Orders';
import OrderTracking from './pages/OrderTracking';
import Prescription from './pages/Prescription';
import Profile from './pages/Profile';
import IdentifyPlant from './pages/IdentifyPlant';
import Contact from './pages/Contact';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsConditions from './pages/TermsConditions';
import FAQ from './pages/FAQ';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import ManageMedicines from './pages/admin/ManageMedicines';
import ManageOrders from './pages/admin/ManageOrders';
import ManageUsers from './pages/admin/ManageUsers';
import AdminAnalytics from './pages/admin/Analytics';
import ManageSellers from './pages/admin/ManageSellers';
import ManagePayouts from './pages/admin/ManagePayouts';
import ManagePayments from './pages/admin/ManagePayments';
import SellerDashboard from './pages/seller/Dashboard';
import SellerOrders from './pages/seller/Orders';
import SellerCustomers from './pages/seller/SellerCustomers';
import SellerEarnings from './pages/seller/SellerEarnings';
import SellerBankSetup from './pages/seller/SellerBankSetup';
import AdminDeliveryStaff from './pages/admin/DeliveryStaff';
import DeliveryDashboard from './pages/delivery/DeliveryDashboard';
import SellerDeliveryTracking from './pages/seller/DeliveryTracking';
import AdminDeliveryTracking from './pages/admin/DeliveryTracking';
import Reviews from './pages/Reviews';
import NewsletterSubscribers from './pages/admin/NewsletterSubscribers';
import SupportInbox from './pages/admin/SupportInbox';

function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="main-content">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/seller-register" element={<SellerRegister />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/medicine/:id" element={<MedicineDetail />} />
          <Route path="/identify-plant" element={<IdentifyPlant />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsConditions />} />

          {/* Protected Customer Routes */}
          <Route path="/customer/dashboard" element={<ProtectedRoute customerOnly><Navigate to="/shop" replace /></ProtectedRoute>} />
          <Route path="/cart" element={<ProtectedRoute customerOnly><Cart /></ProtectedRoute>} />
          <Route path="/wishlist" element={<ProtectedRoute customerOnly><Wishlist /></ProtectedRoute>} />
          <Route path="/checkout" element={<ProtectedRoute customerOnly><Checkout /></ProtectedRoute>} />
          <Route path="/demo-payment" element={<ProtectedRoute customerOnly><DemoPayment /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute customerOnly><Orders /></ProtectedRoute>} />
          <Route path="/orders/:id" element={<ProtectedRoute customerOnly><OrderTracking /></ProtectedRoute>} />
          <Route path="/prescriptions" element={<ProtectedRoute customerOnly><Prescription /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/medicines" element={<ProtectedRoute adminOnly><ManageMedicines /></ProtectedRoute>} />
          <Route path="/admin/orders" element={<ProtectedRoute adminOnly><ManageOrders /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute adminOnly><ManageUsers /></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute adminOnly><AdminAnalytics /></ProtectedRoute>} />
          <Route path="/admin/sellers" element={<ProtectedRoute adminOnly><ManageSellers /></ProtectedRoute>} />
          <Route path="/admin/payouts" element={<ProtectedRoute adminOnly><ManagePayouts /></ProtectedRoute>} />
          <Route path="/admin/payments" element={<ProtectedRoute adminOnly><ManagePayments /></ProtectedRoute>} />
          <Route path="/admin/reviews" element={<ProtectedRoute adminOnly><Reviews /></ProtectedRoute>} />
          <Route path="/admin/subscribers" element={<ProtectedRoute adminOnly><NewsletterSubscribers /></ProtectedRoute>} />
          <Route path="/admin/support" element={<ProtectedRoute adminOnly><SupportInbox /></ProtectedRoute>} />
          <Route path="/admin/delivery-staff" element={<ProtectedRoute adminOnly><AdminDeliveryStaff /></ProtectedRoute>} />
          <Route path="/admin/delivery/:id/tracking" element={<ProtectedRoute adminOnly><AdminDeliveryTracking /></ProtectedRoute>} />

          {/* Seller Routes */}
          <Route path="/seller" element={<ProtectedRoute sellerOnly><SellerDashboard /></ProtectedRoute>} />
          <Route path="/seller/dashboard" element={<ProtectedRoute sellerOnly><SellerDashboard /></ProtectedRoute>} />
          <Route path="/seller/products" element={<ProtectedRoute sellerOnly><ManageMedicines sellerMode /></ProtectedRoute>} />
          <Route path="/seller/orders" element={<ProtectedRoute sellerOnly><SellerOrders /></ProtectedRoute>} />
          <Route path="/seller/customers" element={<ProtectedRoute sellerOnly><SellerCustomers /></ProtectedRoute>} />
          <Route path="/seller/earnings" element={<ProtectedRoute sellerOnly><SellerEarnings /></ProtectedRoute>} />
          <Route path="/seller/payment-setup" element={<ProtectedRoute sellerOnly><SellerBankSetup /></ProtectedRoute>} />
          <Route path="/seller/reviews" element={<ProtectedRoute sellerOnly><Reviews sellerMode /></ProtectedRoute>} />
          <Route path="/seller/orders/:id/tracking" element={<ProtectedRoute sellerOnly><SellerDeliveryTracking /></ProtectedRoute>} />
          <Route path="/delivery-staff" element={<ProtectedRoute deliveryStaffOnly><DeliveryDashboard /></ProtectedRoute>} />
        </Routes>
      </main>
      <Footer />
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
    </div>
  );
}

export default App;
