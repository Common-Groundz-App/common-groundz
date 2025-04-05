import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Star, Search, User, Settings, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/Logo';

export function SidebarNavigation() {
  const navItems = [
    { icon: Home, label: 'Home', href: '/' },
    { icon: Star, label: 'Feed', href: '/feed' },
    { icon: Search, label: 'Search', href: '#', onClick: () => window.dispatchEvent(new Event('open-search-dialog')) },
    { icon: User, label: 'Profile', href: '/profile' },
    { icon: Bell, label: 'Notifications', href: '/notifications' },
    { icon: Settings, label: 'Settings', href: '/settings' },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 w-16 md:w-64 bg-sidebar border-r border-sidebar-border pb-12 pt-16 overflow-y-auto flex flex-col z-10">
      {/* Logo at the top */}
      <div className="flex justify-center md:justify-start px-4 mb-6">
        <Logo size="md" />
      </div>
      
      <nav className="px-2 space-y-1">
        {navItems.map((item) => (
          <NavItem key={item.label} icon={item.icon} label={item.label} href={item.href} onClick={item.onClick} />
        ))}
      </nav>
      
    </aside>
  );
}

function NavItem({ icon: Icon, label, href, onClick }) {
  return (
    <NavLink
      to={href.startsWith('#') ? '' : href}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
        )
      }
      onClick={(e) => {
        if (href.startsWith('#') && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <Icon className="h-5 w-5" />
      <span className="hidden md:inline-block">{label}</span>
    </NavLink>
  );
}
