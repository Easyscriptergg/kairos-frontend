import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { KairosProvider } from './data/store/KairosStore';
import AppShell from './components/layout/AppShell';

// Pages
import Home from './pages/Home/Home';
import Train from './pages/Train/Train';
import Recover from './pages/Recover/Recover';
import Fuel from './pages/Fuel/Fuel';
import Perform from './pages/Perform/Perform';
import Insights from './pages/Insights/Insights';
import Calendar from './pages/Calendar/Calendar';
import Connections from './pages/Connections/Connections';
import Profile from './pages/Profile/Profile';
import Settings from './pages/Settings/Settings';

export default function App() {
  return (
    <KairosProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="train" element={<Train />} />
            <Route path="recover" element={<Recover />} />
            <Route path="fuel" element={<Fuel />} />
            <Route path="perform" element={<Perform />} />
            <Route path="insights" element={<Insights />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="connections" element={<Connections />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </KairosProvider>
  );
}
