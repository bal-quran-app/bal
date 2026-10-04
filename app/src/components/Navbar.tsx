import React, { useState } from 'react';
import { Menu, X, BookOpen, Compass, List, ShieldAlert, Library } from 'lucide-react';

interface NavbarProps {
  currentHash: string;
}

export const Navbar: React.FC<NavbarProps> = ({ currentHash }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { hash: '#/', label: 'الرئيسية', icon: Compass },
    { hash: '#/journey', label: 'الرحلة', icon: BookOpen },
    { hash: '#/words', label: 'الألفاظ', icon: List },
    { hash: '#/tests', label: 'اختبار الحالات', icon: ShieldAlert },
    { hash: '#/sources', label: 'المصادر', icon: Library },
  ];

  const isActive = (hash: string) => {
    if (hash === '#/') {
      return currentHash === '#/' || currentHash === '' || currentHash === '#';
    }
    return currentHash.startsWith(hash);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF7F0]/95 backdrop-blur-xs border-b border-[#1F5F5B]/15">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* الشعار */}
        <a
          href="#/"
          className="flex items-center gap-2 group text-[#1F5F5B] hover:text-[#164845] transition-colors"
        >
          <span className="font-amiri text-3xl font-bold tracking-tight">بَلْ</span>
          <span className="text-xs text-[#5B6B6B] hidden sm:inline-block font-sans">
            ألفاظ تظن أنك تعرف معناها
          </span>
        </a>

        {/* روابط سطح المكتب */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const active = isActive(link.hash);
            return (
              <a
                key={link.hash}
                href={link.hash}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#1F5F5B] text-white shadow-xs'
                    : 'text-[#5B6B6B] hover:text-[#1D2B2A] hover:bg-black/5'
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* زر قائمة الجوال */}
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-md text-[#1F5F5B] hover:bg-black/5 focus:outline-hidden"
            aria-label={mobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* قائمة الجوال المنسدلة */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#1F5F5B]/10 bg-[#FAF7F0] px-4 pt-2 pb-4 space-y-1 shadow-lg">
          {navLinks.map((link) => {
            const active = isActive(link.hash);
            const Icon = link.icon;
            return (
              <a
                key={link.hash}
                href={link.hash}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium ${
                  active
                    ? 'bg-[#1F5F5B] text-white'
                    : 'text-[#1D2B2A] hover:bg-black/5'
                }`}
              >
                <Icon className="w-4 h-4 opacity-75" />
                <span>{link.label}</span>
              </a>
            );
          })}
        </div>
      )}
    </header>
  );
};
