import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useKairos, MODE_LABELS } from '../../data/store/KairosStore';
import {
  Home, Dumbbell, Heart, Utensils, Trophy, Brain,
  Calendar, Link2, User, Settings,
  Zap, Menu, X, AlertTriangle, RefreshCw,
} from 'lucide-react';
import heroAthlete from '../../assets/kairos-hero-athlete.jpg';
import SignInScreen from '../auth/SignInScreen';
import './AppShell.css';

const mainNavItems = [
  { path: '/', label: 'Overview', icon: Home },
  { path: '/train', label: 'Training', icon: Dumbbell },
  { path: '/recover', label: 'Recovery', icon: Heart },
  { path: '/fuel', label: 'Nutrition', icon: Utensils },
  { path: '/perform', label: 'Performance', icon: Trophy },
  { path: '/insights', label: 'Insights', icon: Brain },
];

const secondaryNavItems = [
  { path: '/calendar', label: 'Calendar', icon: Calendar },
  { path: '/connections', label: 'Connections', icon: Link2 },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const mobileNavItems = [
  { path: '/', label: 'Overview', icon: Home },
  { path: '/train', label: 'Training', icon: Dumbbell },
  { path: '/recover', label: 'Recovery', icon: Heart },
  { path: '/fuel', label: 'Nutrition', icon: Utensils },
  { path: '/insights', label: 'Insights', icon: Brain },
];

export default function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { state, actions } = useKairos();
  const modeLabel = MODE_LABELS[state.mode];
  // Settings stays reachable when loading fails, so the data source can always be changed
  const showLoadError = state.status === 'error' && location.pathname !== '/settings';
  const showSignIn = state.status === 'signed-out' && location.pathname !== '/settings';
  // The overview is the only route laid out over the full-bleed hero photograph
  const immersive = location.pathname === '/';

  return (
    <div className={`app-shell ${immersive ? 'shell-immersive' : ''}`}>
      {/* Cinematic athlete photograph: hero on the overview, faint atmosphere elsewhere */}
      <div className="shell-backdrop" aria-hidden="true">
        <img src={heroAthlete} alt="" className="shell-backdrop-img" />
      </div>

      {/* Desktop Navigation Rail */}
      <aside className="rail" aria-label="Main navigation">
        <NavLink to="/" className="rail-brand" aria-label="Kairos overview">
          <span className="rail-brand-mark">
            <Zap size={22} strokeWidth={2.4} />
          </span>
          <span className="rail-brand-text">
            <span className="rail-brand-name">Kairos</span>
            <span className="rail-brand-sub">Performance OS</span>
          </span>
        </NavLink>

        <nav className="rail-nav">
          {mainNavItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`}
              end={item.path === '/'}
              aria-label={item.label}
            >
              <item.icon size={19} strokeWidth={1.75} />
              <span className="rail-tip" aria-hidden="true">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <nav className="rail-nav rail-nav-secondary" aria-label="System">
          {secondaryNavItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `rail-item rail-item-sm ${isActive ? 'active' : ''}`}
              aria-label={item.label}
            >
              <item.icon size={17} strokeWidth={1.75} />
              <span className="rail-tip" aria-hidden="true">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <NavLink to="/settings" className={`rail-mode rail-mode-${state.mode}`} title={`${modeLabel.label} — ${modeLabel.description} Change in Settings.`}>
          <span className="badge-dot"></span>
          {modeLabel.short}
        </NavLink>
      </aside>

      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="mobile-header-left">
          <span className="rail-brand-mark rail-brand-mark-sm">
            <Zap size={17} strokeWidth={2.4} />
          </span>
          <span className="logo-text-mobile">Kairos</span>
          <NavLink to="/settings" className={`rail-mode rail-mode-${state.mode}`}>
            <span className="badge-dot"></span>
            {modeLabel.short}
          </NavLink>
        </div>
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu" onClick={e => e.stopPropagation()}>
            {[...mainNavItems, ...secondaryNavItems].map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `mobile-menu-item ${isActive ? 'active' : ''}`}
                end={item.path === '/'}
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon size={20} strokeWidth={1.75} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`main-content ${immersive ? 'is-immersive' : ''}`}>
        {state.saveError && (
          <div className="shell-alert" role="alert">
            <AlertTriangle size={16} />
            <span><strong>Not saved.</strong> {state.saveError}</span>
            <button className="icon-btn" onClick={actions.dismissSaveError} aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        )}

        <div className="page-container animate-fade-in" key={location.pathname}>
          {state.mode === 'demo' && !immersive && state.status === 'ready' && (
            <NavLink to="/settings" className="mode-banner">
              <span className="badge-dot"></span>
              <span><strong>Demo data.</strong> A sample athlete, not real measurements. Switch to your own data in Settings.</span>
            </NavLink>
          )}

          {state.status === 'loading' ? (
            <div className="shell-state" aria-busy="true">
              <RefreshCw size={22} className="shell-spinner" />
              <p>Loading athlete data…</p>
            </div>
          ) : showSignIn ? (
            <SignInScreen />
          ) : showLoadError ? (
            <div className="shell-state" role="alert">
              <AlertTriangle size={28} className="text-danger" />
              <h1 className="shell-state-title">Your data could not be loaded</h1>
              <p>{state.error}</p>
              <p className="shell-state-source">Source: {modeLabel.label}. Nothing is being shown in its place.</p>
              <div className="form-actions">
                <button className="btn btn-primary" onClick={actions.reload}>
                  <RefreshCw size={15} /> Try again
                </button>
                <NavLink to="/settings" className="btn btn-secondary">Change data source</NavLink>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {mobileNavItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
            end={item.path === '/'}
          >
            <item.icon size={20} strokeWidth={1.75} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
