import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiFilter, FiX, FiGrid, FiList } from 'react-icons/fi';
import MedicineCard from '../components/MedicineCard';
import SearchBar from '../components/SearchBar';
import { medicineApi } from '../api/medicineApi';
import Loading from '../components/Loading';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'newest', label: 'Newest First' },
];

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [medicines, setMedicines] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const page = parseInt(searchParams.get('page') || '1');
  const q = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const sortBy = searchParams.get('sort_by') || 'relevance';
  const minPrice = searchParams.get('min_price') || '';
  const maxPrice = searchParams.get('max_price') || '';
  const availableOnly = searchParams.get('available') === 'true';

  const fetchMedicines = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, sort_by: sortBy };
      if (q) params.q = q;
      if (category) params.category = category;
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;
      if (availableOnly) params.available_only = true;

      const { data } = await medicineApi.search(params);
      setMedicines(data.items || []);
      setTotalPages(data.total_pages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      setMedicines([]);
    } finally {
      setLoading(false);
    }
  }, [page, q, category, sortBy, minPrice, maxPrice, availableOnly]);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  useEffect(() => {
    medicineApi.getCategories().then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  const updateParam = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.delete('page');
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const activeFilterCount = [category, minPrice, maxPrice, availableOnly ? 'yes' : ''].filter(Boolean).length;

  return (
    <div className="page-wrapper">
      <section className="section" style={{ paddingTop: '40px' }}>
        <div className="container">
          {/* Header */}
          <div className="shop-header">
            <div>
              <h1 className="section-title" style={{ marginBottom: 4 }}>
                {q ? `Results for "${q}"` : category ? category.replace(/_/g, ' ') : 'All Herbal Products'}
              </h1>
              <p className="text-gray text-sm">{total} products found</p>
            </div>
            <div className="shop-controls">
              <button className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters(!showFilters)}>
                <FiFilter size={14} /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              </button>
              <select className="form-input form-select btn-sm" value={sortBy} onChange={(e) => updateParam('sort_by', e.target.value)} style={{ width: 'auto' }}>
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Search Bar */}
          <div style={{ maxWidth: 560, marginBottom: 24 }}>
            <SearchBar />
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="filter-panel animate-slideDown">
              <div className="filter-panel-header">
                <h3 className="font-semibold">Filters</h3>
                <button className="btn-ghost text-sm" onClick={clearFilters}>Clear All</button>
              </div>
              <div className="filter-grid">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Category</label>
                  <select className="form-input form-select" value={category} onChange={(e) => updateParam('category', e.target.value)}>
                    <option value="">All Categories</option>
                    {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Min Price (₹)</label>
                  <input type="number" className="form-input" placeholder="0" value={minPrice} onChange={(e) => updateParam('min_price', e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Max Price (₹)</label>
                  <input type="number" className="form-input" placeholder="9999" value={maxPrice} onChange={(e) => updateParam('max_price', e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">&nbsp;</label>
                  <label className="checkbox-wrap">
                    <input type="checkbox" checked={availableOnly} onChange={(e) => updateParam('available', e.target.checked ? 'true' : '')} />
                    <span className="checkmark" />
                    In Stock Only
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Active Filter Tags */}
          {activeFilterCount > 0 && (
            <div className="active-filters">
              {category && (
                <span className="filter-tag">
                  {category.replace(/_/g, ' ')} <FiX size={12} onClick={() => updateParam('category', '')} />
                </span>
              )}
              {minPrice && (
                <span className="filter-tag">Min: ₹{minPrice} <FiX size={12} onClick={() => updateParam('min_price', '')} /></span>
              )}
              {maxPrice && (
                <span className="filter-tag">Max: ₹{maxPrice} <FiX size={12} onClick={() => updateParam('max_price', '')} /></span>
              )}
              {availableOnly && (
                <span className="filter-tag">In Stock <FiX size={12} onClick={() => updateParam('available', '')} /></span>
              )}
            </div>
          )}

          {/* Products Grid */}
          {loading ? (
            <Loading />
          ) : medicines.length === 0 ? (
            <div className="empty-state">
              <h3>No Products Found</h3>
              <p>Try adjusting your filters or search terms</p>
              <button className="btn btn-primary btn-sm" onClick={clearFilters}>Clear Filters</button>
            </div>
          ) : (
            <>
              <div className="grid-4">
                {medicines.map((med) => <MedicineCard key={med.id} medicine={med} />)}
              </div>
              {totalPages > 1 && (
                <div className="pagination">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => updateParam('page', p.toString())}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}