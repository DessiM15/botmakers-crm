"use client";
import { useEffect } from "react";
import { ToastContainer } from "react-toastify";
export default function PluginInit() {
  useEffect(() => {
    import("bootstrap/dist/js/bootstrap.bundle.min.js").catch(() => {});
  }, []);
  return <ToastContainer position="top-right" autoClose={4000} theme="dark" />;
}
