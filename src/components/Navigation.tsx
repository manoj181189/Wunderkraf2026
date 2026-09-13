import React from 'react';
import { 
  LayoutDashboard, 
  Cpu, 
  Network, 
  Package, 
  Hammer, 
  Truck, 
  Gauge
} from 'lucide-react';

export type TabKey = 
  | 'dashboard'
  | 'mrp'
  | 'bom'
  | 'inventory'
  | 'production'
  | 'procurement'
  | 'capacity';

interface NavigationProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  deficitCount: number;
  openPosCount: number;
  activeOrdersCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  deficitCount,
  openPosCount,
  activeOrdersCount,
}) => {
  const tabs = [
    {
      key: 'dashboard' as TabKey,
      label: 'Operations Cockpit',
      icon: LayoutDashboard,
    },
    {
      key: 'mrp' as TabKey,
      label: 'MRP Engine & Netting',
      icon: Cpu,
      badge: deficitCount > 0 ? `${deficitCount} shortages` : undefined,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    },
    {
      key: 'bom' as TabKey,
      label: 'BOM Studio & Costing',
      icon: Network,
    },
    {
      key: 'inventory' as TabKey,
      label: 'Warehouse & Stock',
      icon: Package,
    },
    {
      key: 'production' as TabKey,
      label: 'Production Schedule',
      icon: Hammer,
      badge: `${activeOrdersCount} jobs`,
      badgeColor: 'bg-neutral-800 text-neutral-300 border-neutral-700',
    },
    {
      key: 'procurement' as TabKey,
      label: 'Procurement & POs',
      icon: Truck,
      badge: `${openPosCount} active`,
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    {
      key: 'capacity' as TabKey,
      label: 'Shop Work Centers',
      icon: Gauge,
    },
  ];

  return (
    <nav className="border-b border-neutral-800 bg-neutral-950 px-4 lg:px-8 overflow-x-auto no-scrollbar">
      <div className="flex space-x-1 min-w-max py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onSelectTab(tab.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-neutral-800 text-amber-400 shadow-sm border border-neutral-700/80'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-neutral-500'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full border ${tab.badgeColor}`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
