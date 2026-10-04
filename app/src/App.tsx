/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { JourneyPage } from './pages/JourneyPage';
import { WordsPage } from './pages/WordsPage';
import { TestsPage } from './pages/TestsPage';
import { SourcesPage } from './pages/SourcesPage';

export default function App() {
  const [currentHash, setCurrentHash] = useState<string>(
    window.location.hash || '#/'
  );

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '#/';
      setCurrentHash(hash);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const renderPage = () => {
    const route = currentHash.replace(/\/+$/, '') || '#/';

    if (route === '#/journey') {
      return <JourneyPage />;
    }
    if (route === '#/words') {
      return <WordsPage />;
    }
    if (route === '#/tests') {
      return <TestsPage />;
    }
    if (route === '#/sources') {
      return <SourcesPage />;
    }
    return <HomePage />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F0] text-[#1D2B2A]">
      <Navbar currentHash={currentHash} />
      <main className="flex-1 flex flex-col">{renderPage()}</main>
      <Footer />
    </div>
  );
}
