import React, { useMemo, useState } from 'react'
import { Search, MapPin, Star, Check } from 'lucide-react'
import '../styles/home.css'

type Restaurant = {
  id: number
  name: string
  neighborhood: string
  city: string
  verified: boolean
  imageUrl: string
  rating: number
  reviewCount: number
  priceRange: string
  cuisine: string
  dietaryTags: string[]
}

export default function CrunchHomePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState('NYC')

  const cities = useMemo(() => ['NYC', 'LA', 'San Francisco', 'Austin', 'Miami'], [])

  const stats = useMemo(() => ({
    totalRestaurants: 47,
    verifiedRestaurants: 23,
    totalCities: 5,
    pendingReviews: 8,
  }), [])

  const featuredRestaurants: Restaurant[] = useMemo(() => ([
    {
      id: 1,
      name: 'Farm to Table NYC',
      neighborhood: 'West Village',
      city: 'NYC',
      verified: true,
      imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=500&fit=crop',
      rating: 4.8,
      reviewCount: 127,
      priceRange: '$$$',
      cuisine: 'American',
      dietaryTags: ['Paleo', 'Whole30', 'Keto'],
    },
    {
      id: 2,
      name: 'Pure Eats',
      neighborhood: 'Greenwich Village',
      city: 'NYC',
      verified: true,
      imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=500&fit=crop',
      rating: 4.6,
      reviewCount: 89,
      priceRange: '$$',
      cuisine: 'Healthy Fast-Casual',
      dietaryTags: ['Keto', 'Organic'],
    },
    {
      id: 3,
      name: 'Ancestral Kitchen',
      neighborhood: 'East Village',
      city: 'NYC',
      verified: false,
      imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop',
      rating: 4.9,
      reviewCount: 203,
      priceRange: '$$$$',
      cuisine: 'Modern American',
      dietaryTags: ['Paleo', 'Keto', 'Whole30'],
    },
  ]), [])

  const filteredRestaurants = useMemo(
    () => featuredRestaurants.filter((r) => r.city === selectedCity && r.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [featuredRestaurants, selectedCity, searchQuery]
  )

  return (
    <div className="home min-h">
      {/* Nav */}
      <nav className="nav-bar">
        <div className="container-safe nav-row">
          <div className="brand-left">
            <div className="brand-mark" aria-label="Crunch">🥗</div>
            <div className="brand-name">Crunch</div>
            <div className="brand-city">{selectedCity}</div>
          </div>
          <div className="brand-actions">
            <button className="btn chip green">Home</button>
            <button className="btn link">Browse</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero hero-gradient">
        <div className="container-safe hero-inner">
          <h1 className="hero-title">
            Discover Restaurants That <span className="accent-green">Crunch</span> Clean
          </h1>
          <p className="hero-sub">
            Find restaurants in {selectedCity} that avoid industrial seed oils and prioritize your health
          </p>

          <div className="hero-controls">
            <div className="city-select">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="select"
                aria-label="Select city"
              >
                {cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="field flex-1">
              <Search className="icon-left" width={20} height={20} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search restaurants, cuisine, or neighborhood..."
                className="input with-icon"
              />
            </div>

            <button className="btn primary">Find Restaurants</button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="container-safe section">
        <div className="stats-grid">
          <div className="card stat">
            <div className="stat-value accent-green">{filteredRestaurants.length}</div>
            <div className="stat-label">Restaurants in {selectedCity}</div>
          </div>
          <div className="card stat">
            <div className="stat-value accent-blue">{stats.verifiedRestaurants}</div>
            <div className="stat-label">Verified by Crunch</div>
          </div>
          <div className="card stat">
            <div className="stat-value">{stats.totalCities}</div>
            <div className="stat-label">Cities Covered</div>
          </div>
          <div className="card stat">
            <div className="stat-value">{stats.pendingReviews}</div>
            <div className="stat-label">Pending Reviews</div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="container-safe section">
        <div className="newsletter">
          <div className="newsletter-grid">
            <div>
              <h2 className="section-title">Stay Updated</h2>
              <p className="muted">Get notified when we add new restaurants or expand to new cities</p>
            </div>
            <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
              <input type="email" placeholder="Enter your email" className="input" />
              <button className="btn light">Subscribe</button>
            </form>
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="container-safe section">
        <h2 className="section-title">Featured in {selectedCity}</h2>
        <div className="featured-grid">
          {filteredRestaurants.map((r) => (
            <RestaurantCard key={r.id} restaurant={r} />
          ))}
        </div>
        {filteredRestaurants.length === 0 && (
          <div className="empty">No restaurants found in {selectedCity}. Help us expand by submitting restaurants!</div>
        )}
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container-safe footer-grid">
          <div>
            <div className="brand-line"><span className="brand-mark">🥗</span><span className="brand-name">Crunch</span></div>
            <p className="muted">
              Helping you find restaurants that prioritize your health by avoiding industrial seed oils.
            </p>
            <div className="muted small">Currently serving:</div>
            <div className="chips">
              {cities.map((c) => (
                <span key={c} className="chip">{c}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="footer-title">Quick Links</div>
            <ul className="footer-links">
              <li><button className="link">Home</button></li>
              <li><button className="link">Browse Restaurants</button></li>
              <li><button className="link">Submit Restaurant</button></li>
            </ul>
          </div>
          <div>
            <div className="footer-title">Stats</div>
            <ul className="footer-links">
              <li>{stats.totalRestaurants} Total Restaurants</li>
              <li>{stats.verifiedRestaurants} Verified Listings</li>
              <li>{stats.totalCities} Cities Covered</li>
              <li className="muted small">Last updated: {new Date().toLocaleDateString()}</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">© {new Date().getFullYear()} Crunch. All rights reserved.</div>
      </footer>
    </div>
  )
}

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  return (
    <div className="card featured">
      <div className="featured-media">
        <img src={restaurant.imageUrl} alt={restaurant.name} />
        <div className="badge price">{restaurant.priceRange}</div>
        {restaurant.verified && (
          <div className="badge verify">
            <Check width={14} height={14} /> Verified
          </div>
        )}
      </div>
      <div className="featured-body">
        <div className="featured-top">
          <h3 className="featured-name">{restaurant.name}</h3>
          <div className="rating">
            <Star width={16} height={16} /> {restaurant.rating}
            <span className="muted">({restaurant.reviewCount})</span>
          </div>
        </div>
        <div className="meta-row">
          <MapPin width={16} height={16} />
          <span>{restaurant.neighborhood}</span>
          <span className="dot" />
          <span>{restaurant.cuisine}</span>
        </div>
        <div className="taglist">
          {restaurant.dietaryTags.slice(0, 3).map((t) => (
            <span key={t} className="tag">{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
