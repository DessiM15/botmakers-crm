"use client";
import React from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import Link from "next/link";
import { signOutAction } from "@/lib/actions/auth";

const PortalLayout = ({ children }) => {
  return (
    <div className='portal-layout'>
      <header className='portal-header d-flex align-items-center justify-content-between'>
        <Link href='/portal' className='d-flex align-items-center gap-2 text-white text-decoration-none'>
          <img
            src='/assets/images/botmakers-logo.png'
            alt='Botmakers'
            style={{ height: 28 }}
          />
        </Link>
        <div className='d-flex align-items-center gap-3'>
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
