import React from 'react'
import EmployeeSidebar from '../components/EmpolyeeDashboard/EmployeeSidebar'
import { Outlet } from 'react-router-dom'
import Navbar from '../components/dashboard/Navbar'

const EmployeeDashboard = () => {
  return (
    <div className='flex'>
      <EmployeeSidebar />
      <div className='flex-1'>
        <Navbar />
        <Outlet />
      </div>
    </div>
  )
}

export default EmployeeDashboard
