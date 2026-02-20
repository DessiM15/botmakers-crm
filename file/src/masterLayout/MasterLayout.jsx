"use client";
import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOutAction } from "@/lib/actions/auth";
import NotificationBell from "@/components/crm/NotificationBell";

const sidebarItems = [
  { label: "Dashboard", icon: "solar:home-smile-angle-outline", href: "/" },
  { label: "Pipeline", icon: "mage:dashboard-2", href: "/pipeline" },
  { label: "Leads", icon: "gridicons:multiple-users", href: "/leads" },
  { label: "Referrals", icon: "mdi:account-group-outline", href: "/referrals" },
  { label: "Clients", icon: "mdi:account-tie", href: "/clients" },
  { label: "Projects", icon: "solar:folder-with-files-outline", href: "/projects" },
  { label: "Proposals", icon: "mdi:file-document-edit-outline", href: "/proposals" },
  { label: "Invoices", icon: "mdi:receipt-text-outline", href: "/invoices" },
  { label: "Email Generator", icon: "solar:letter-outline", href: "/email-generator" },
  "separator",
  { label: "Settings", icon: "solar:settings-outline", href: "/settings" },
  { label: "Activity Log", icon: "mdi:history", href: "/activity" },
];

const MasterLayout = ({ children }) => {
  const pathname = usePathname();
  const [sidebarActive, setSidebarActive] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("data-theme", "dark");
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
              src='/assets/images/botmakers-logo.png'
              alt='Botmakers CRM'
              className='logo-icon'
              style={{ height: 24 }}
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
          <div className='px-20 pb-20 mt-auto'>
            <div className='d-flex flex-column gap-2'>
              <a
                href='https://botmakers.ai'
                target='_blank'
                rel='noopener noreferrer'
                className='d-flex align-items-center gap-2 text-secondary-light text-sm hover-text-primary'
              >
                <Icon icon='mdi:open-in-new' className='text-lg' />
                <span>View Website</span>
              </a>
              <form action={signOutAction}>
                <button
                  type='submit'
                  className='d-flex align-items-center gap-2 text-secondary-light text-sm hover-text-danger bg-transparent border-0 p-0'
                >
                  <Icon icon='lucide:power' className='text-lg' />
                  <span>Logout</span>
                </button>
              </form>
            </div>
          </div>
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
                {/* Notification Bell */}
                <NotificationBell />
                {/* User profile dropdown */}
                <div className='dropdown'>
                  <button
                    className='d-flex justify-content-center align-items-center rounded-circle'
                    type='button'
                    data-bs-toggle='dropdown'
                  >
                    <span className='w-40-px h-40-px bg-primary-600 rounded-circle d-flex justify-content-center align-items-center text-white fw-semibold'>
                      <Icon icon='solar:user-bold' className='text-xl' />
                    </span>
                  </button>
                  <div className='dropdown-menu to-top dropdown-menu-sm'>
                    <div className='py-12 px-16 radius-8 bg-primary-50 mb-16 d-flex align-items-center justify-content-between gap-2'>
                      <div>
                        <h6 className='text-lg text-primary-light fw-semibold mb-2'>
                          Botmakers CRM
                        </h6>
                        <span className='text-secondary-light fw-medium text-sm'>
                          Admin
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
                          className='dropdown-item text-black px-0 py-8 hover-bg-transparent hover-text-primary d-flex align-items-center gap-3'
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
                            className='dropdown-item text-black px-0 py-8 hover-bg-transparent hover-text-danger d-flex align-items-center gap-3 bg-transparent border-0 w-100'
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

        {/* dashboard-main-body */}
        <div className='dashboard-main-body'>{children}</div>

        {/* Footer section */}
        <footer className='d-footer'>
          <div className='row align-items-center justify-content-between'>
            <div className='col-auto'>
              <p className='mb-0'>© 2025 BotMakers Inc. All Rights Reserved.</p>
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
