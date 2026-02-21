"use client";
import React from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import Link from "next/link";
import { signOutAction } from "@/lib/actions/auth";

const PortalLayout = ({ children, isPreview = false, clientName = '' }) => {
  return (
    <div className='portal-layout'>
      {/* Admin preview banner */}
      {isPreview && (
        <div
          className='d-flex align-items-center justify-content-center gap-3 py-2 px-3'
          style={{
            background: '#ffc107',
            color: '#333',
            fontSize: '13px',
            fontWeight: 600,
            position: 'sticky',
            top: 0,
            zIndex: 1100,
          }}
        >
          <Icon icon='mdi:eye-outline' style={{ fontSize: '16px' }} />
          <span>Admin Preview — Viewing as {clientName}</span>
          <a
            href='/clients'
            className='text-decoration-none fw-semibold'
            style={{ color: '#033457', marginLeft: '12px' }}
          >
            &larr; Back to CRM
          </a>
        </div>
      )}
      <header className='portal-header d-flex align-items-center justify-content-between'>
        <Link href={isPreview ? '#' : '/portal'} className='d-flex align-items-center gap-2 text-white text-decoration-none'>
          <img
            src='/assets/images/botmakers-logo.png'
            alt='Botmakers'
            style={{ height: 28 }}
          />
        </Link>
        <div className='d-flex align-items-center gap-3'>
          {!isPreview && (
            <form action={signOutAction}>
              <button
                type='submit'
                className='d-flex align-items-center gap-2 text-white bg-transparent border-0'
                style={{ fontSize: 14 }}
              >
                <Icon icon='lucide:power' className='text-lg' />
                <span>Logout</span>
              </button>
            </form>
          )}
        </div>
      </header>
      <main className='portal-content'>
        {children}
      </main>
      <footer className='text-center py-16 text-secondary-light' style={{ fontSize: 13 }}>
        <p className='mb-0'>
          &copy; 2025 BotMakers Inc. &mdash;{" "}
          <a href='https://botmakers.ai' target='_blank' rel='noopener noreferrer'>
            botmakers.ai
          </a>
        </p>
      </footer>
    </div>
  );
};

export default PortalLayout;
