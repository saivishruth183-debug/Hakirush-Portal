import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import PrivateRoutes from "./utils/PrivateRoutes";
import RoleBaseRoutes from "./utils/RoleBaseRoutes";
import RootRedirect from "./utils/RootRedirect";
import EmployeeSetting from "./pages/Setting";
import Unauthorized from "./pages/Unauthorized";
import SetupPassword from "./pages/SetupPassword";
import ForgotPassword from "./pages/ForgotPassword";

/* ================= LAZY LOADED ROUTE COMPONENTS ================= */
// Code-split to drastically reduce initial JS chunk size and speed up Time-to-Interactive
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminSummary = lazy(() => import("./components/dashboard/AdminSummary"));
const DepartmentList = lazy(() => import("./components/departments/DepartmentList"));
const AddDepartments = lazy(() => import("./components/departments/AddDepartments"));
const EditDepartment = lazy(() => import("./components/departments/EditDepartment"));
const DepartmentEmployees = lazy(() => import("./components/departments/DepartmentEmployees"));
const EmplyeeList = lazy(() => import("./components/employee/EmployeeList"));
const EmplyeeAdd = lazy(() => import("./components/employee/EmployeeAdd"));
const EmplyeeView = lazy(() => import("./components/employee/EmployeeView"));
const EmplyeeEdit = lazy(() => import("./components/employee/EmployeeEdit"));
const AddPayslip = lazy(() => import("./components/payslips/AddPayslip"));
const ClientList = lazy(() => import("./components/client/ClinetList"));
const ClientAdd = lazy(() => import("./components/client/ClientAdd"));
const ClientEdit = lazy(() => import("./components/client/ClientEdit"));
const ViewClient = lazy(() => import("./components/client/ClientView"));
const ClientContentAdmin = lazy(() => import("./components/client/ClientContentAdmin"));
const SponsorList = lazy(() => import("./components/sponsor/SponsorList"));
const SponsorAdd = lazy(() => import("./components/sponsor/SponsorAdd"));
const SponsorEdit = lazy(() => import("./components/sponsor/SponsorEdit"));
const SponsorView = lazy(() => import("./components/sponsor/SponsorView"));
const StallList = lazy(() => import("./components/stalls/StallList"));
const StallAdd = lazy(() => import("./components/stalls/StallAdd"));
const StallEdit = lazy(() => import("./components/stalls/StallEdit"));
const StallView = lazy(() => import("./components/stalls/StallView"));
const AdminAttendence = lazy(() => import("./components/attendance/AdminAttendance"));
const AdminAttendenceReport = lazy(() => import("./components/attendance/AdminAttendanceReport"));
const AdminAttendanceRequests = lazy(() => import("./components/attendance/AdminAttendanceRequests"));
const AdminLeaveTable = lazy(() => import("./components/leave/AdminLeaveTable"));
const LeaveDetails = lazy(() => import("./components/leave/LeaveDetails"));
const EmployeeLeaveList = lazy(() => import("./components/leave/EmployeeLeaveList"));
const HolidaysList = lazy(() => import("./components/holidays/HolidayList"));
const AddHoliday = lazy(() => import("./components/holidays/AddHolidays"));
const AdminAnnouncement = lazy(() => import("./components/announcement/AdminAnnouncement"));
const EditAnnouncement = lazy(() => import("./components/announcement/EditAnnouncement"));
const AdminAssets = lazy(() => import("./components/assets/AdminAssets"));
const AdminExpenses = lazy(() => import("./components/expenses/AdminExpenses"));

/* ================= EMPLOYEE IMPORTS ================= */
const EmployeeDashboard = lazy(() => import("./pages/EmployeeDashboard"));
const EmpolyeeSummary = lazy(() => import("./components/EmpolyeeDashboard/EmployeeSummary"));
const EmployeeLeaveAdd = lazy(() => import("./components/leave/EmployeeLeaveAdd"));
const EmployeeProfile = lazy(() => import("./components/EmpolyeeDashboard/EmployeeProfile"));
const EditEmployeeProfile = lazy(() => import("./components/EmpolyeeDashboard/EditEmployeeProfile"));
const ViewPayslip = lazy(() => import("./components/payslips/ViewPayslip"));
const TeamRequests = lazy(() => import("./components/leave/TeamRequests"));
const EmployeeExpenses = lazy(() => import("./components/expenses/EmployeeExpenses"));
const EmployeeOvertime = lazy(() => import("./components/attendance/EmployeeOvertime"));

/* ================= CLIENT IMPORTS ================= */
const ClientDashboard = lazy(() => import("./pages/ClientDashboard"));
const ClientSummary = lazy(() => import("./components/ClientDashboard/ClientSummary"));
const ClientRoster = lazy(() => import("./components/ClientDashboard/ClientRoster"));

/* Lightweight branding fallback spinner */
const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-[#FAF8F5]">
    <div className="flex flex-col items-center gap-3">
      <div className="h-9 w-9 animate-spin rounded-full border-3 border-[#7A2233] border-t-transparent" />
      <span className="text-xs font-semibold uppercase tracking-widest text-[#7A2233]">Loading Portal...</span>
    </div>
  </div>
);

const App = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ROOT & AUTH */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/setup-password" element={<SetupPassword />} />

          {/* ================= ADMIN ROUTES ================= */}
          <Route
            path="/admin-dashboard"
            element={
              <PrivateRoutes>
                <RoleBaseRoutes requiredRole={["admin"]}>
                  <AdminDashboard />
                </RoleBaseRoutes>
              </PrivateRoutes>
            }
          >
            <Route index element={<AdminSummary />} />
            <Route path="departments" element={<DepartmentList />} />
            <Route path="add-department" element={<AddDepartments />} />
            <Route path="department/:id" element={<EditDepartment />} />
            <Route path="department/:id/employees" element={<DepartmentEmployees />} />

            <Route path="employees" element={<EmplyeeList />} />
            <Route path="add-employee" element={<EmplyeeAdd />} />
            <Route path="employees/:id" element={<EmplyeeView />} />
            <Route path="employees/edit/:id" element={<EmplyeeEdit />} />
            <Route path="employees/payslip/:id" element={<AddPayslip />} />

            <Route path="clients" element={<ClientList />} />
            <Route path="add-client" element={<ClientAdd />} />
            <Route path="clients/content" element={<ClientContentAdmin />} />
            <Route path="clients/:id/content" element={<ClientContentAdmin />} />
            <Route path="clients/:id" element={<ViewClient />} />
            <Route path="clients/edit/:id" element={<ClientEdit />} />

            <Route path="leaves" element={<AdminLeaveTable />} />
            <Route path="leaves/:id" element={<LeaveDetails />} />
            <Route path="employees/leaves/:id" element={<EmployeeLeaveList />} />

            <Route path="attendance" element={<AdminAttendence />} />
            <Route path="attendance-report" element={<AdminAttendenceReport />} />
            <Route path="attendance-requests" element={<AdminAttendanceRequests />} />

            <Route path="expenses" element={<AdminExpenses />} />

            <Route path="holidays" element={<HolidaysList />} />
            <Route path="add-holiday" element={<AddHoliday />} />

            <Route path="sponsors" element={<SponsorList />} />
            <Route path="add-sponsor" element={<SponsorAdd />} />
            <Route path="sponsors/:id" element={<SponsorView />} />
            <Route path="sponsors/edit/:id" element={<SponsorEdit />} />

            <Route path="stalls" element={<StallList />} />
            <Route path="add-stall" element={<StallAdd />} />
            <Route path="stalls/:id" element={<StallView />} />
            <Route path="stalls/edit/:id" element={<StallEdit />} />

            <Route path="announcement" element={<AdminAnnouncement />} />
            <Route path="announcement/edit/:id" element={<EditAnnouncement />} />

            <Route path="assets" element={<AdminAssets />} />
          </Route>

          {/* ================= EMPLOYEE ROUTES ================= */}
          <Route
            path="/employee-dashboard"
            element={
              <PrivateRoutes>
                <RoleBaseRoutes requiredRole={["admin", "employee"]}>
                  <EmployeeDashboard />
                </RoleBaseRoutes>
              </PrivateRoutes>
            }
          >
            <Route index element={<EmpolyeeSummary />} />
            <Route path="profile/:id" element={<EmployeeProfile />} />
            <Route path="profile/:id/edit" element={<EditEmployeeProfile />} />
            <Route path="leaves/:id" element={<EmployeeLeaveList />} />
            <Route path="add-leave" element={<EmployeeLeaveAdd />} />
            <Route path="overtime" element={<EmployeeOvertime />} />
            <Route path="expenses" element={<EmployeeExpenses />} />
            <Route path="team-requests" element={<TeamRequests />} />
            <Route path="team-requests/:id" element={<LeaveDetails />} />
            <Route path="payslips/:id" element={<ViewPayslip />} />
            <Route path="setting" element={<EmployeeSetting />} />
          </Route>

          {/* ================= CLIENT ROUTES ================= */}
          <Route
            path="/client-dashboard"
            element={
              <PrivateRoutes>
                <RoleBaseRoutes requiredRole={["client"]}>
                  <ClientDashboard />
                </RoleBaseRoutes>
              </PrivateRoutes>
            }
          >
            <Route index element={<ClientSummary />} />
            <Route path="roster/:id" element={<ClientRoster />} />
            <Route path="setting" element={<EmployeeSetting />} />
          </Route>

          {/* ================= UNAUTHORIZED ================= */}
          <Route path="/unauthorized" element={<Unauthorized />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;