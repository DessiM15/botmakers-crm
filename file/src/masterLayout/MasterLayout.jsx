"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { signOutAction } from "@/lib/actions/auth";
import NotificationBell from "@/components/crm/NotificationBell";
import VoiceCommand from "@/components/crm/VoiceCommand";
import RealtimeNotificationProvider from "@/components/crm/RealtimeNotificationProvider";
import GlobalSearch from "@/components/crm/GlobalSearch";
import Avatar from "@/components/crm/Avatar";

const sidebarItems = [
  { label: "Dashboard", icon: "solar:home-smile-angle-outline", href: "/" },
  { label: "Pipeline", icon: "mage:dashboard-2", href: "/pipeline" },
  { label: "Leads", icon: "gridicons:multiple-users", href: "/leads" },
  { label: "Referrals", icon: "mdi:account-group-outline", href: "/referrals" },
  { label: "Clients", icon: "mdi:account-tie", href: "/clients" },
  { label: "Contacts", icon: "mdi:contacts-outline", href: "/contacts" },
  { label: "Projects", icon: "solar:folder-with-files-outline", href: "/projects" },
  { label: "Proposals", icon: "mdi:file-document-edit-outline", href: "/proposals" },
  { label: "Invoices", icon: "mdi:receipt-text-outline", href: "/invoices" },
  { label: "Costs & P&L", icon: "mdi:chart-box-outline", href: "/costs" },
  { label: "Services", icon: "mdi:server-network", href: "/services" },
  { label: "Email Generator", icon: "solar:letter-outline", href: "/email-generator" },
  { label: "Docs", icon: "mdi:notebook-edit-outline", href: "/docs" },
  { label: "Meetings", icon: "mdi:calendar-check-outline", href: "/meetings" },
  { label: "Calendar", icon: "mdi:calendar-month-outline", href: "/calendar" },
  { label: "Notifications", icon: "mdi:bell-outline", href: "/notifications" },
  "separator",
  { label: "Settings", icon: "solar:settings-outline", href: "/settings" },
  { label: "Activity Log", icon: "mdi:history", href: "/activity" },
];

const MasterLayout = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarActive, setSidebarActive] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [demoToggling, setDemoToggling] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("data-theme", "dark");
      // Check if demo_mode cookie is set
      setDemoMode(document.cookie.split(';').some(c => c.trim().startsWith('demo_mode=true')));
    }
    fetch('/api/auth/me')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setCurrentUser(data); })
      .catch(() => {});
  }, []);

  const toggleDemoMode = useCallback(async () => {
    setDemoToggling(true);
    try {
      const res = await fetch('/api/demo-mode', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setDemoMode(data.demoMode);
        window.location.reload();
      }
    } catch {
      // ignore
    } finally {
      setDemoToggling(false);
    }
  }, []);

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const sidebarControl = () => {
    setSidebarActive(!sidebarActive);
  };

  const mobileMenuControl = () => {
    setMobileMenu(!mobileMenu);
  };

  return (
    <section className={mobileMenu ? "overlay active" : "overlay "}>
      {/* sidebar */}
      <aside
        className={
          sidebarActive
            ? "sidebar active "
            : mobileMenu
            ? "sidebar sidebar-open"
            : "sidebar"
        }
      >
        <button
          onClick={mobileMenuControl}
          type='button'
          className='sidebar-close-btn'
        >
          <Icon icon='radix-icons:cross-2' />
        </button>
        <div>
          <Link href='/' className='sidebar-logo'>
            <img
              src='/assets/images/botmakers-logo.png'
              alt='Botmakers CRM'
              className='light-logo'
              style={{ height: 28 }}
            />
            <img
              src='/assets/images/botmakers-logo.png'
              alt='Botmakers CRM'
              className='dark-logo'
              style={{ height: 28 }}
            />
            <img
              src='/icons/icon-192.png'
              alt='Botmakers CRM'
              className='logo-icon'
              style={{ height: 36, width: 36, borderRadius: 6, objectFit: 'cover' }}
            />
          </Link>
        </div>
        <div className='sidebar-menu-area'>
          <ul className='sidebar-menu' id='sidebar-menu'>
            <li className='sidebar-menu-group-title'>Main</li>
            {sidebarItems.map((item, index) => {
              if (item === "separator") {
                return (
                  <li key={`sep-${index}`} className='sidebar-menu-group-title'>
                    System
                  </li>
                );
              }
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={isActive(item.href) ? "active-page" : ""}
                  >
                    <Icon icon={item.icon} className='menu-icon' />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Sidebar footer */}
          <ul className='sidebar-menu mt-auto pb-20'>
            <li>
              <a
                href='https://botmakers.ai'
                target='_blank'
                rel='noopener noreferrer'
              >
                <Icon icon='mdi:open-in-new' className='menu-icon' />
                <span>View Website</span>
              </a>
            </li>
            <li>
              <form action={signOutAction}>
                <button
                  type='submit'
                  className='bg-transparent border-0 p-0 w-100 text-start d-flex align-items-center'
                  style={{ color: 'inherit', font: 'inherit' }}
                >
                  <Icon icon='lucide:power' className='menu-icon' />
                  <span>Logout</span>
                </button>
              </form>
            </li>
          </ul>
        </div>
      </aside>

      <main
        className={sidebarActive ? "dashboard-main active" : "dashboard-main"}
      >
        <div className='navbar-header'>
          <div className='row align-items-center justify-content-between'>
            <div className='col-auto'>
              <div className='d-flex flex-wrap align-items-center gap-4'>
                <button
                  type='button'
                  className='sidebar-toggle'
                  onClick={sidebarControl}
                >
                  {sidebarActive ? (
                    <Icon
                      icon='iconoir:arrow-right'
                      className='icon text-2xl non-active'
                    />
                  ) : (
                    <Icon
                      icon='heroicons:bars-3-solid'
                      className='icon text-2xl non-active'
                    />
                  )}
                </button>
                <button
                  onClick={mobileMenuControl}
                  type='button'
                  className='sidebar-mobile-toggle'
                >
                  <Icon icon='heroicons:bars-3-solid' className='icon' />
                </button>
              </div>
            </div>
            <div className='col-auto'>
              <div className='d-flex flex-wrap align-items-center gap-3'>
                {/* Global Search Trigger */}
                <button
                  type="button"
                  className="d-flex justify-content-center align-items-center rounded-circle"
                  title="Search (⌘K)"
                  onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <span className="w-40-px h-40-px bg-base rounded-circle d-flex justify-content-center align-items-center">
                    <Icon icon="mdi:magnify" className="text-secondary-light text-xl" />
                  </span>
                </button>
                {/* Demo Mode Toggle (admin only) */}
                {currentUser?.role === 'admin' && (
                  <button
                    type="button"
                    className="d-flex align-items-center gap-1 border-0 rounded-pill px-12 py-6"
                    title={demoMode ? 'Demo mode ON — click to deactivate' : 'Activate demo mode'}
                    onClick={toggleDemoMode}
                    disabled={demoToggling}
                    style={{
                      background: demoMode ? '#7c3aed' : 'rgba(255,255,255,0.08)',
                      color: demoMode ? '#fff' : '#999',
                      cursor: demoToggling ? 'wait' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                    }}
                  >
                    {demoToggling ? (
                      <span className="spinner-border spinner-border-sm" style={{ width: 12, height: 12 }} />
                    ) : (
                      <Icon icon={demoMode ? 'mdi:play-circle' : 'mdi:play-circle-outline'} style={{ fontSize: 16 }} />
                    )}
                    <span>Demo</span>
                  </button>
                )}
                {/* Notification Bell */}
                <NotificationBell />
                {/* User profile dropdown */}
                <div className='dropdown'>
                  <button
                    className='d-flex justify-content-center align-items-center rounded-circle'
                    type='button'
                    data-bs-toggle='dropdown'
                  >
                    <Avatar
                      src={currentUser?.avatarUrl}
                      name={currentUser?.fullName}
                      size={40}
                    />
                  </button>
                  <div className='dropdown-menu to-top dropdown-menu-sm'>
                    <div className='py-12 px-16 radius-8 bg-primary-50 mb-16 d-flex align-items-center justify-content-between gap-2'>
                      <div>
                        <h6 className='text-lg text-primary-light fw-semibold mb-2'>
                          {currentUser?.fullName || 'Botmakers CRM'}
                        </h6>
                        <span className='text-secondary-light fw-medium text-sm'>
                          {currentUser?.fullName ? 'Team Member' : 'Admin'}
                        </span>
                      </div>
                      <button type='button' className='hover-text-danger'>
                        <Icon
                          icon='radix-icons:cross-1'
                          className='icon text-xl'
                        />
                      </button>
                    </div>
                    <ul className='to-top-list'>
                      <li>
                        <Link
                          className='dropdown-item text-secondary-light px-0 py-8 hover-bg-transparent hover-text-primary d-flex align-items-center gap-3'
                          href='/settings'
                        >
                          <Icon
                            icon='solar:settings-outline'
                            className='icon text-xl'
                          />
                          Settings
                        </Link>
                      </li>
                      <li>
                        <form action={signOutAction}>
                          <button
                            type='submit'
                            className='dropdown-item text-secondary-light px-0 py-8 hover-bg-transparent hover-text-danger d-flex align-items-center gap-3 bg-transparent border-0 w-100'
                          >
                            <Icon icon='lucide:power' className='icon text-xl' />
                            Log Out
                          </button>
                        </form>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Demo Mode Banner */}
        {demoMode && (
          <div
            className="d-flex align-items-center justify-content-center gap-2 py-8 px-16"
            style={{
              background: '#7c3aed',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.3px',
              position: 'sticky',
              top: 0,
              zIndex: 999,
            }}
          >
            <Icon icon="mdi:play-circle" style={{ fontSize: 16 }} />
            DEMO MODE — Showing sample data
            <button
              type="button"
              className="btn btn-sm border-0 ms-2 d-flex align-items-center"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '11px', padding: '2px 8px' }}
              onClick={toggleDemoMode}
              disabled={demoToggling}
            >
              Deactivate
            </button>
          </div>
        )}

        {/* dashboard-main-body */}
        <div className='dashboard-main-body'>{children}</div>

        {/* Voice Command */}
        <VoiceCommand />

        {/* Real-time Notification Subscription */}
        <RealtimeNotificationProvider />

        {/* Global Search Palette */}
        <GlobalSearch />

        {/* Footer section */}
        <footer className='d-footer'>
          <div className='row align-items-center justify-content-between'>
            <div className='col-auto'>
              <p className='mb-0'>© 2026 BotMakers Inc. All Rights Reserved.</p>
            </div>
            <div className='col-auto'>
              <p className='mb-0'>
                Powered by{" "}
                <a
                  href='https://botmakers.ai'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary-600'
                >
                  botmakers.ai
                </a>
              </p>
            </div>
          </div>
        </footer>
      </main>
    </section>
  );
};

export default MasterLayout;
