import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/dashboard/Navbar";
import ClientSidebar from "../components/ClientDashboard/ClientSidebar";

const ClientDashboard = () => {
  return (
    <div className="flex">
      <ClientSidebar />

      <div className="flex-1">
        <Navbar />
        <Outlet />
      </div>
    </div>
  );
};

export default ClientDashboard;