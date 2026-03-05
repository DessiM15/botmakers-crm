'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';

const TABS = [
  { key: 'uploaded', label: 'Uploaded Files', icon: 'mdi:cloud-upload-outline' },
  { key: 'editable', label: 'Editable Documents', icon: 'mdi:file-document-edit-outline' },
];

const DocsPageTabs = ({ activeTab }) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const switchTab = (tabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabKey);
    // Reset filters when switching tabs
    params.delete('search');
    params.delete('category');
    params.delete('entity_type');
    params.delete('page');
    router.push(`/docs?${params.toString()}`);
  };

  return (
    <ul className="nav nav-pills mb-3 border-bottom border-secondary-light pb-2" role="tablist">
      {TABS.map((tab) => (
        <li className="nav-item" key={tab.key} role="presentation">
          <button
            className={`nav-link d-flex align-items-center gap-2 ${activeTab === tab.key ? 'active' : 'text-secondary-light'}`}
            onClick={() => switchTab(tab.key)}
            type="button"
            role="tab"
          >
            <Icon icon={tab.icon} style={{ fontSize: '18px' }} />
            {tab.label}
          </button>
        </li>
      ))}
    </ul>
  );
};

export default DocsPageTabs;
