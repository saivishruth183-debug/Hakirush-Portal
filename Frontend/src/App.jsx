import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import PrivateRoutes from "./utils/PrivateRoutes";
import RoleBaseRoutes from "./utils/RoleBaseRoutes";
import RootRedirect from "./utils/RootRedirect";
import EmployeeSetting from "./pages/Setting";
import Unauthorized from "./pages/Unauthorized";
import SetupPassword from "./pages/SetupPassword";

/* ================= ADMIN IMPORTS ================= */
import AdminDashboard from "./pages/AdminDashboard";
import AdminSummary from "./components/dashboard/AdminSummary";
import DepartmentList from "./components/departments/DepartmentList";
import AddDepartments from "./components/departments/AddDepartments";
import EditDepartment from "./components/departments/EditDepartment";
import DepartmentEmployees from "./components/departments/DepartmentEmployees";
import EmplyeeList from "./components/employee/EmployeeList";
import EmplyeeAdd from "./components/employee/EmployeeAdd";
import EmplyeeView from "./components/employee/EmployeeView";
import EmplyeeEdit from "./components/employee/EmployeeEdit";
import ClientList from "./components/client/ClinetList";
import ClientAdd from "./components/client/ClientAdd";
import ClientEdit from "./components/client/ClientEdit";
import ViewClient from "./components/client/ClientView";
import SponsorList from "./components/sponsor/SponsorList";
import SponsorAdd from "./components/sponsor/SponsorAdd";
import SponsorEdit from "./components/sponsor/SponsorEdit";
import SponsorView from "./components/sponsor/SponsorView";
import StallList from "./components/stalls/StallList";
import StallAdd from "./components/stalls/StallAdd";
import StallEdit from "./components/stalls/StallEdit";
import StallView from "./components/stalls/StallView";
import AdminAttendence from "./components/attendance/AdminAttendance";
import AdminAttendenceReport from "./components/attendance/AdminAttendanceReport";
import AdminAttendanceRequests from "./components/attendance/AdminAttendanceRequests";
import EmployeeLeaveList from "./components/leave/EmployeeLeaveList";
import AdminLeaveTable from "./components/leave/AdminLeaveTable";
import LeaveDetails from "./components/leave/LeaveDetails";
import HolidaysList from "./components/holidays/HolidayList";
import AddHoliday from "./components/holidays/AddHolidays";
import AdminAnnouncement from "./components/announcement/AdminAnnouncement";
import EditAnnouncement from "./components/announcement/EditAnnouncement";
import AddPayslip from "./components/payslips/AddPayslip";
import AdminAssets from "./components/assets/AdminAssets";

/* ================= EMPLOYEE IMPORTS ================= */
import EmployeeDashboard from "./pages/EmployeeDashboard";
import EmpolyeeSummary from "./components/EmpolyeeDashboard/EmployeeSummary";
import EmployeeLeaveAdd from "./components/leave/EmployeeLeaveAdd";
import EmployeeProfile from "./components/EmpolyeeDashboard/EmployeeProfile";
import EditEmployeeProfile from "./components/EmpolyeeDashboard/EditEmployeeProfile";
import ViewPayslip from "./components/payslips/ViewPayslip";
import TeamRequests from "./components/leave/TeamRequests";


/* ================= CLIENT IMPORTS ================= */
import ClientDashboard from "./pages/ClientDashboard";
import ClientSummary from "./components/ClientDashboard/ClientSummary";
import ClientRelationship from "./components/ClientDashboard/ClientRelationship";


const App = () => {
  return (
    <BrowserRouter>
      <Routes>

        {/* ROOT & AUTH */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
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
          <Route path="clients/:id" element={<ViewClient />} />
          <Route path="clients/edit/:id" element={<ClientEdit />} />

          <Route path="leaves" element={<AdminLeaveTable />} />
          <Route path="leaves/:id" element={<LeaveDetails />} />
          <Route path="employees/leaves/:id" element={<EmployeeLeaveList />} />

          <Route path="attendance" element={<AdminAttendence />} />
          <Route path="attendance-report" element={<AdminAttendenceReport />} />
          <Route path="/admin-dashboard/attendance-requests" element={<AdminAttendanceRequests />} />

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
          <Route path="ourrelationship/:id" element={<ClientRelationship />} />
          <Route path="setting" element={<EmployeeSetting />} />
        </Route>

        {/* ================= UNAUTHORIZED ================= */}
        <Route path="/unauthorized" element={<Unauthorized />} />

      </Routes>
    </BrowserRouter>
  );
};

export default App;