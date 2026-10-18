import axios from "axios";
import {
  CalendarDays, ChevronLeft, ChevronRight,
  X, Bell, Activity, ArrowRight, Umbrella,
  Megaphone, Cake, Award, Clock, Send, CheckCircle2, XCircle, Clock3,
  Users, UserPlus, RefreshCw, MapPin, Loader2, Sun, Sunrise, Moon, PartyPopper,
  CalendarCheck2, TrendingUp, FileClock, Trash2, AlertTriangle, Timer, Sparkles,
} from "lucide-react";
import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/authContext";
import EmployeePunch from "../attendance/EmployeePunch";
import { apiErrorMessage } from "../../utils/apiError";

const NOTICE_TYPES = ["leave-status", "attendance-request-status"];

/* ================= DESIGN TOKENS ================= */
const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

/* Calendar day colours (status keys come from getDayInfo) */
const DAY_STYLE = {
  present: { cell: "bg-emerald-500 text-white shadow-md shadow-emerald-500/30", dot: "bg-emerald-500", label: "Present" },
  halfday: { cell: "bg-amber-400 text-white shadow-md shadow-amber-400/30", dot: "bg-amber-400", label: "Half day" },
  absent: { cell: "bg-red-600 text-white shadow-md shadow-red-600/30", dot: "bg-red-600", label: "Absent" },
  working: { cell: "bg-sky-500 text-white shadow-md shadow-sky-500/30", dot: "bg-sky-500", label: "Working" },
  leave: { cell: "bg-violet-500 text-white shadow-md shadow-violet-500/30", dot: "bg-violet-500", label: "Leave" },
  holiday: { cell: "bg-rose-50 text-rose-700 ring-1 ring-rose-200", dot: "bg-rose-300", label: "Holiday" },
  weekend: { cell: "bg-gray-50 text-gray-300", dot: "bg-gray-200", label: "Weekend" },
  none: { cell: "bg-white text-gray-700 ring-1 ring-gray-100 hover:ring-red-200", dot: "bg-white ring-1 ring-gray-200", label: "Working day" },
};

const TEAM_INITIAL = {
  status: "loading", // loading | ok | error
  error: "",
  department: null,
  managerStatus: null, // assigned | unassigned | no_department
  manager: null,
  members: [],
  totalMembers: 0,
  hasMore: false,
};

// "MM-DD" -> Date in the given year (null if malformed)
const monthDayToDate = (monthDay, year) => {
  if (typeof monthDay !== "string") return null;
  const match = /^(\d{2})-(\d{2})$/.exec(monthDay);
  if (!match) return null;
  const d = new Date(year, Number(match[1]) - 1, Number(match[2]));
  return isNaN(d.getTime()) ? null : d;
};

// Upcoming-days count for a recurring "MM-DD" date (birthdays / anniversaries)
const daysUntilMonthDay = (monthDay) => {
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = monthDayToDate(monthDay, today.getFullYear());
  if (!next) return null;
  if (next < todayMid) next = monthDayToDate(monthDay, today.getFullYear() + 1);
  return Math.round((next - todayMid) / (1000 * 60 * 60 * 24));
};

/* ================= UI HELPERS ================= */
const AVATAR_BG = ["from-red-500 to-rose-400", "from-violet-500 to-fuchsia-400", "from-sky-500 to-cyan-400", "from-amber-500 to-orange-400", "from-emerald-500 to-teal-400"];
const colorFor = (s = "") => AVATAR_BG[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length];
const initialsOf = (name = "") => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const resolveImg = (p) => {
  if (!p) return null;
  if (String(p).startsWith("http")) return p;
  const baseUrl = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");
  return `${baseUrl}/${String(p).replace(/^\//, "")}`;
};

const Avatar = ({ path, name, size = "h-9 w-9 text-xs", ring = "ring-2 ring-white" }) => {
  const [failed, setFailed] = useState(false);
  const src = resolveImg(path);
  return src && !failed ? (
    <img src={src} alt="" onError={() => setFailed(true)} className={`shrink-0 rounded-full object-cover ${ring} ${size}`} />
  ) : (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${colorFor(name)} font-bold text-white ${ring} ${size}`}>{initialsOf(name)}</div>
  );
};

const Modal = ({ children, onClose, size = "max-w-md" }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <motion.div className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div role="dialog" aria-modal="true"
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-gray-100 sm:rounded-3xl ${size}`}>
        <div className="absolute left-1/2 top-2 z-20 h-1.5 w-12 -translate-x-1/2 rounded-full bg-white/60 sm:hidden" />
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
};

const Widget = ({ icon: Icon, tone = "bg-red-50 text-red-600", title, subtitle, live, action, children, className = "" }) => (
  <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`${CARD} flex flex-col p-5 ${className}`}>
    <div className="mb-4 flex items-center gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={16} /></div>
      <div className="min-w-0 flex-1">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          {title}
          {live && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" /></span>}
        </h3>
        {subtitle && <p className="truncate text-xs text-gray-400">{subtitle}</p>}
      </div>
      {action}
    </div>
    <div className="no-scrollbar -mx-1 flex-1 space-y-1.5 overflow-y-auto px-1">{children}</div>
  </motion.section>
);

const Empty = ({ icon: Icon, text }) => (
  <div className="flex h-full min-h-[8rem] flex-col items-center justify-center gap-2 text-center text-gray-300">
    <Icon size={26} strokeWidth={1.6} />
    <span className="text-xs font-semibold text-gray-400">{text}</span>
  </div>
);

const PersonRow = ({ path, name, sub, right, highlight }) => (
  <div className={`flex items-center gap-3 rounded-2xl p-2 transition ${highlight ? "bg-red-50/70 ring-1 ring-red-100" : "hover:bg-gray-50"}`}>
    <Avatar path={path} name={name} />
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-gray-900">{name}</p>
      {sub && <p className="truncate text-xs text-gray-400">{sub}</p>}
    </div>
    {right}
  </div>
);

// One SafePerson row: { employeeRecordId, userId, employeeCode, name, designation, profileImageUrl, isSelf, isManager }
const TeamPersonRow = ({ person, isManager = false }) => {
  const name = person?.name || "Team member";
  const subtitle = [person?.designation, person?.employeeCode].filter(Boolean).join(" · ");
  return (
    <PersonRow path={person?.profileImageUrl} name={name} sub={subtitle} highlight={isManager}
      right={
        <div className="flex shrink-0 items-center gap-1">
          {isManager && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-red-200">Manager</span>}
          {person?.isSelf && <span className="rounded-full bg-gradient-to-r from-red-600 to-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">You</span>}
        </div>
      } />
  );
};

const EmployeeSummary = () => {
  const { user, loading } = useAuth();
  const [team, setTeam] = useState(TEAM_INITIAL);
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]); 
  const [leaveBalance, setLeaveBalance] = useState({ casual: 0, sick: 0 });
  const [showLeaveBreakdown, setShowLeaveBreakdown] = useState(false);
  const [attendance, setAttendance] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);
  const [showBellMenu, setShowBellMenu] = useState(false);
  const [birthdays, setBirthdays] = useState({ today: [], upcoming: [] });
  const [anniversaries, setAnniversaries] = useState({ today: [], upcoming: [] });
  const [notifications, setNotifications] = useState([]);
  const [newEmployees, setNewEmployees] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null); 
  const [myRequests, setMyRequests] = useState([]);
  const [requestForm, setRequestForm] = useState({ requestedStatus: "Present", reason: "" });
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const TOTAL_ANNUAL_CASUAL = 12; 
  const TOTAL_ANNUAL_SICK = 12;   
  // UI-only state
  const [requestError, setRequestError] = useState("");
  const [toast, setToast] = useState("");
  const [deletingRequest, setDeletingRequest] = useState(false);
  
  const getImageUrl = (imagePath) => {
    if (!imagePath) return "/default-avatar.png";
    if (imagePath.startsWith("http")) return imagePath;
    const baseUrl = import.meta.env.VITE_BACKEND_URL.replace(/\/$/, "");
    const cleanPath = imagePath.replace(/^\//, "");
    return `${baseUrl}/${cleanPath}`;
  };

  const toYMD = (d) => {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "Ongoing": return "bg-red-50 text-red-700 border-red-200";
      case "Completed": return "bg-gray-100 text-gray-500 border-gray-200";
      default: return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  };

  // Returns a human-readable "joined X days ago" string for the New Employees card
  const getDaysAgo = (date) => {
    if (!date) return "Joined recently";
    const joined = new Date(date);
    if (isNaN(joined.getTime())) return "Joined recently";

    const today = new Date();
    // Normalize both to midnight so partial-day differences don't cause off-by-one results
    const joinedMid = new Date(joined.getFullYear(), joined.getMonth(), joined.getDate());
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const diffMs = todayMid - joinedMid;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (days <= 0) return "Joined today";
    if (days === 1) return "Joined 1 day ago";
    if (days < 30) return `Joined ${days} days ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return months === 1 ? "Joined 1 month ago" : `Joined ${months} months ago`;

    const years = Math.floor(months / 12);
    return years === 1 ? "Joined 1 year ago" : `Joined ${years} years ago`;
  };

  const hasUnseenNotices = announcements.some((a) => {
    const seenByArray = a.seenBy || [];
    return !seenByArray.map(id => id.toString()).includes(user?._id?.toString());
  }) || notifications.some(n => !n.seen);

  // Fetch leave-status + attendance-request-status notifications for employee
  useEffect(() => {
    if (!user?._id) return;
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.success) setNotifications(res.data.notifications.filter(n => NOTICE_TYPES.includes(n.type)));
      } catch {
        // Notifications are best effort; the bell simply stays empty.
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Fetch my attendance correction requests
  useEffect(() => {
    if (!user?._id) return;
    const token = localStorage.getItem("token");
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL}/api/attendance-request/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => { if (res.data?.success) setMyRequests(res.data.requests); })
      .catch(() => {});
  }, [user, calendarMonth]);

  const markAsSeenOnServer = async (announcementId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/api/announcements/${announcementId}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAnnouncements(prev => 
        prev.map(a => 
          a._id === announcementId 
            ? { ...a, seenBy: [...(a.seenBy || []), user._id.toString()] } 
            : a
        )
      );
    } catch (error) { 
      console.error(error); 
    }
  };

  const getDayInfo = (day) => {
    if (!day) return { status: "none", title: "" };
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    const dateStr = toYMD(date);

    const holidayRec = holidays.find(h => toYMD(h.date) === dateStr);
    if (holidayRec) return { status: "holiday", title: holidayRec.title };

    if (date.getDay() === 0 || date.getDay() === 6) {
        return { status: "weekend", title: date.getDay() === 0 ? "Sunday" : "Saturday" };
    }

    const activeLeave = leaves.find(l => {
      if (l.status !== "Approved") return false;
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      return date >= start && date <= end;
    });

    if (activeLeave) return { status: "leave", title: activeLeave.leaveType };

    const attRec = attendance.find(a => toYMD(a.date) === dateStr);
    if (attRec) {
      const s = (attRec.status || "").toLowerCase().replace(/\s+/g, "");
      const workedHours = Number(attRec.workedHours || 0);
      const todayStr = toYMD(new Date());
      const isPastDay = dateStr < todayStr;

      // 1. Explicit statuses take precedence
      if (s === "present") {
        return { status: "present", title: "Present" };
      }
      if (s === "halfday") {
        return { status: "halfday", title: "Half Day" };
      }
      if (s === "leave") {
        return { status: "leave", title: "Leave" };
      }

      // 2. Completed punches with checkout
      if (attRec.checkOut) {
        if (workedHours >= 8) {
          return { status: "present", title: "Present" };
        }
        if (workedHours >= 4 && workedHours < 8) {
          return { status: "halfday", title: "Half Day" };
        }
        return { status: "absent", title: "Absent" };
      }

      // 3. Checked in but forgot to checkout: mark as Present
      if (attRec.checkIn && !attRec.checkOut) {
        if (isPastDay) {
          return { status: "present", title: "Present" };
        }
        return { status: "working", title: "Working" };
      }

      if (["present", "halfday", "absent"].includes(s)) {
        return { status: s, title: attRec.status };
      }
    }
    return { status: "none", title: "Working Day" };
  };

  const generateCalendar = () => {
    const y = calendarMonth.getFullYear(); 
    const m = calendarMonth.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    return [
      ...Array(firstDay).fill(null), 
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
    ];
  };

  const formatBday = (dateString) => {
    if(!dateString) return "";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short' 
    }).toUpperCase();
  };

  // Department-scoped feeds send `monthDay: "MM-DD"` (no year / dob / age for employees).
  const formatMonthDay = (monthDay, fallbackDate) => {
    // leap year so "02-29" renders correctly
    const d = monthDayToDate(monthDay, 2000);
    if (d) {
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }).toUpperCase();
    }
    return formatBday(fallbackDate);
  };

  const personName = (p) => p?.userId?.name || p?.name || "Team member";


  // Helper: Get years since joining
  const getYearsJoined = (date) => {
    if (!date) return "1st";
    const diff = new Date().getFullYear() - new Date(date).getFullYear();
    return diff > 0 ? diff : "1st";
  };

  /* ================= DATA FETCHING ================= */
  const userId = user?._id;

  // Department members widget: GET /api/employee/team/me (TeamResponse v1).
  // Independent of the calendar so it is not refetched on month changes.
  const fetchTeam = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/employee/team/me`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        params: { page: 1, limit: 100 },
      });
      const data = res.data || {};
      setTeam({
        status: "ok",
        error: "",
        department: data.department || null,
        managerStatus: data.managerStatus || (data.department ? "unassigned" : "no_department"),
        manager: data.manager || null,
        members: Array.isArray(data.members) ? data.members : [],
        totalMembers: Number(data.totalMembers) || 0,
        hasMore: Boolean(data.hasMore),
      });
    } catch (err) {
      setTeam({ ...TEAM_INITIAL, status: "error", error: apiErrorMessage(err, "Couldn't load your team.") });
    }
  }, [userId]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const retryTeam = () => {
    setTeam(TEAM_INITIAL);
    fetchTeam();
  };

  // fetchData only depends on inputs (user id + calendar month), never on the
  // state it sets, so it cannot re-trigger itself.
  const fetchData = useCallback(() => {
    if (!userId) return;
    const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
    const base = import.meta.env.VITE_BACKEND_URL;

    // allSettled: one failing widget (e.g. 403) must not blank the whole dashboard
    Promise.allSettled([
      axios.get(`${base}/api/holiday/all`, { headers }),
      axios.get(`${base}/api/announcements/public`, { headers }),
      axios.get(`${base}/api/leave/${userId}/employee`, { headers }),
      axios.get(`${base}/api/employee/birthdays`, { headers }),
      axios.get(`${base}/api/attendance/user/${userId}/monthly?month=${calendarMonth.getMonth() + 1}&year=${calendarMonth.getFullYear()}`, { headers }),
      axios.get(`${base}/api/employee/anniversaries`, { headers }),
      axios.get(`${base}/api/employee/new/recent`, { headers })
    ])
    .then(([r2, r3, r4, r5, r6, r7, r8]) => { 
      const ok = (r) => (r.status === "fulfilled" ? r.value?.data : null);
      const listOrEmpty = (v) => (Array.isArray(v) ? v : []);
      const holidayData = listOrEmpty(ok(r2)?.holidays);
      const announcementData = listOrEmpty(ok(r3)?.announcements);
      const allLeaves = listOrEmpty(ok(r4)?.leaves);
      const birthdayRaw = ok(r5) || {};
      const birthdayData = { today: listOrEmpty(birthdayRaw.today), upcoming: listOrEmpty(birthdayRaw.upcoming) };
      const attendanceData = listOrEmpty(ok(r6)?.attendance);
      const anniversaryRaw = ok(r7) || {};
      const anniversaryData = { today: listOrEmpty(anniversaryRaw.today), upcoming: listOrEmpty(anniversaryRaw.upcoming) };
      const newEmployeeData = listOrEmpty(ok(r8)?.employees);

      [r2, r3, r4, r5, r6, r7, r8].forEach((r) => {
        if (r.status === "rejected") console.error("Dashboard widget failed:", apiErrorMessage(r.reason));
      });

      setHolidays(holidayData);
      setAnnouncements(announcementData);
      setLeaves(allLeaves);
      setBirthdays(birthdayData);
      setAttendance(attendanceData);
      setAnniversaries(anniversaryData);
      setNewEmployees(newEmployeeData);

      const getUsedDays = (lt) => {
        const hols = holidayData.map(h => toYMD(h.date));
        return allLeaves.filter(l => l.status === "Approved" && l.leaveType === lt)
          .reduce((total, l) => {
            let count = 0, curr = new Date(l.startDate), last = new Date(l.endDate);
            curr.setHours(0,0,0,0); last.setHours(0,0,0,0);
            while (curr <= last) {
              const dayOfWeek = curr.getDay();
              if (dayOfWeek !== 0 && dayOfWeek !== 6 && !hols.includes(toYMD(curr))) {
                count++;
              }
              curr.setDate(curr.getDate() + 1);
            }
            return total + count;
          }, 0);
      };

      setLeaveBalance({ 
        casual: Math.max(0, TOTAL_ANNUAL_CASUAL - getUsedDays("Casual Leave")), 
        sick: Math.max(0, TOTAL_ANNUAL_SICK - getUsedDays("Sick Leave")) 
      });
    });
  }, [userId, calendarMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAttendanceSuccess = () => {
    fetchData();
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.seen) {
      try {
        const token = localStorage.getItem("token");
        await axios.patch(`${import.meta.env.VITE_BACKEND_URL}/api/notifications/${notification._id}/seen`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(prev => prev.map(item => item._id === notification._id ? { ...item, seen: true } : item));
      } catch (err) {
        console.error(err);
      }
    }

    setShowBellMenu(false);

    if (notification.type === "leave-status") {
      if (user?._id) {
        window.location.href = `/employee-dashboard/leaves/${user._id}`;
      }
      return;
    }

    if (notification.type === "attendance-request-status") {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      setCalendarMonth(monthStart);
      const dateStr = toYMD(today);
      const record = attendance.find((entry) => toYMD(entry.date) === dateStr) || null;
      setSelectedDay({
        day: today.getDate(),
        dateStr,
        status: (record?.status || "Absent").toLowerCase().replace(/\s+/g, ""),
        title: record?.status || "Attendance detail",
        record,
      });
      setRequestForm({ requestedStatus: "Present", reason: "" });
      document.getElementById("attendance-calendar-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Open the zoom modal for a clicked calendar day
  const handleDayClick = (day) => {
    if (!day) return;
    const { status, title } = getDayInfo(day);
    const dateStr = toYMD(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
    const record = attendance.find(a => toYMD(a.date) === dateStr) || null;
    setSelectedDay({ day, dateStr, status, title, record });
    setRequestForm({ requestedStatus: "Present", reason: "" });
    setRequestError("");
  };

  // Submit an attendance correction request for the selected day
  const handleRequestSubmit = async () => {
    if (!selectedDay || !requestForm.reason.trim()) return;
    setSubmittingRequest(true);
    try {
      const token = localStorage.getItem("token");
      const currentStatusLabel = selectedDay.record?.status || (selectedDay.status === "halfday" ? "Half Day" : "Absent");
      const res = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/attendance-request`,
        {
          date: selectedDay.dateStr,
          currentStatus: currentStatusLabel,
          requestedStatus: requestForm.requestedStatus,
          reason: requestForm.reason,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        setMyRequests(prev => [res.data.request, ...prev]);
        setRequestForm({ requestedStatus: "Present", reason: "" });
        setToast("Correction request sent to your manager");
      }
    } catch (err) {
      console.error(err);
      setRequestError(apiErrorMessage(err, "Couldn't send the request. Please try again."));
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Withdraw a pending correction request (same call the old inline Delete button made)
  const deleteRequest = async (existing) => {
    try {
      setDeletingRequest(true);
      const token = localStorage.getItem("token");
      await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL}/api/attendance-request/${existing._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMyRequests((prev) => prev.filter((r) => r._id !== existing._id));
      // Close the modal after deleting
      setSelectedDay(null);
      setToast("Request withdrawn");
    } catch (err) {
      console.log(err);
      setRequestError(apiErrorMessage(err, "Couldn't withdraw the request."));
    } finally {
      setDeletingRequest(false);
    }
  };

  /* ================= UI-ONLY EFFECTS ================= */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!showBellMenu) return;
    const onKey = (e) => e.key === "Escape" && setShowBellMenu(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showBellMenu]);

  if (loading || !user) return (
    <div className={`min-h-screen ${PAGE_BG} p-4 sm:p-6 lg:p-8`}>
      <div className="mx-auto max-w-[1400px] animate-pulse space-y-6">
        <div className="h-10 w-64 rounded-xl bg-white/80" />
        <div className={`${CARD} h-40`} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className={`${CARD} h-28`} />)}</div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3"><div className={`${CARD} h-[28rem] lg:col-span-2`} /><div className={`${CARD} h-[28rem]`} /></div>
      </div>
    </div>
  );

  /* ================= UI-ONLY DERIVED ================= */
  const uid = user?._id?.toString();
  const unseenAnnouncements = announcements.filter((a) => !(a.seenBy || []).map((id) => id.toString()).includes(uid)).length;
  const unseenUpdates = notifications.filter((n) => !n.seen).length;
  const unseenCount = unseenAnnouncements + unseenUpdates;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const GreetIcon = hour < 12 ? Sunrise : hour < 17 ? Sun : Moon;
  const firstName = (user?.name || "").split(" ")[0] || "there";

  const todayStr = toYMD(now);
  const isCurrentMonth = calendarMonth.getFullYear() === now.getFullYear() && calendarMonth.getMonth() === now.getMonth();
  const daysInView = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const monthStats = { present: 0, halfday: 0, absent: 0, leave: 0, holiday: 0, working: 0 };
  for (let d = 1; d <= daysInView; d++) {
    const ds = toYMD(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d));
    if (ds > todayStr) break;
    const { status } = getDayInfo(d);
    if (status in monthStats) monthStats[status]++;
  }
  const countedDays = monthStats.present + monthStats.halfday + monthStats.absent;
  const attendanceRate = countedDays ? Math.round(((monthStats.present + monthStats.halfday * 0.5) / countedDays) * 100) : null;

  const upcomingHolidays = holidays
    .filter((h) => toYMD(h.date) >= todayStr)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const nextHoliday = upcomingHolidays[0];
  const daysTo = (d) => {
    const a = new Date(d); a.setHours(0, 0, 0, 0);
    const b = new Date(); b.setHours(0, 0, 0, 0);
    return Math.round((a - b) / 86400000);
  };
  const pendingRequests = myRequests.filter((r) => r.status === "Pending");
  const totalLeft = leaveBalance.casual + leaveBalance.sick;
  const totalQuota = TOTAL_ANNUAL_CASUAL + TOTAL_ANNUAL_SICK;
  const annCounts = {
    upcoming: announcements.filter((a) => ["upcoming", "coming"].includes(a.status?.toLowerCase())).length,
    ongoing: announcements.filter((a) => a.status?.toLowerCase() === "ongoing").length,
    done: announcements.filter((a) => ["completed", "done"].includes(a.status?.toLowerCase())).length,
  };
  const pendingOn = (dateStr) => myRequests.some((r) => r.date === dateStr && r.status === "Pending");
  const openAnnouncement = (a) => {
    const isRead = a.seenBy?.map((id) => id.toString()).includes(uid);
    setActiveAnnouncement(a);
    setShowBellMenu(false);
    if (!isRead) markAsSeenOnServer(a._id);
  };
  const joinedLabel = (e) =>
    e.dateOfJoining ? getDaysAgo(e.dateOfJoining)
      : typeof e.joinedDaysAgo === "number"
        ? (e.joinedDaysAgo <= 0 ? "Joined today" : e.joinedDaysAgo === 1 ? "Joined 1 day ago" : `Joined ${e.joinedDaysAgo} days ago`)
        : getDaysAgo(e.joiningDate);

  const STAT_CARDS = [
    {
      key: "leave", label: "Leave left", value: totalLeft, suffix: `/ ${totalQuota} days`, Icon: Umbrella, tone: "bg-violet-50 text-violet-600",
      onClick: () => setShowLeaveBreakdown(true), hint: "View breakdown",
    },
    {
      key: "rate", label: isCurrentMonth ? "Attendance this month" : `Attendance · ${calendarMonth.toLocaleString("en-IN", { month: "short" })}`,
      value: attendanceRate === null ? "—" : `${attendanceRate}%`, suffix: countedDays ? `${monthStats.present} present` : "", Icon: TrendingUp, tone: "bg-emerald-50 text-emerald-600",
      onClick: () => document.getElementById("attendance-calendar-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), hint: "Open calendar",
    },
    {
      key: "holiday", label: "Next holiday", value: nextHoliday ? (daysTo(nextHoliday.date) === 0 ? "Today" : `${daysTo(nextHoliday.date)}d`) : "—",
      suffix: nextHoliday?.title || "None scheduled", Icon: PartyPopper, tone: "bg-rose-50 text-rose-600",
    },
    {
      key: "req", label: "Pending requests", value: pendingRequests.length, suffix: pendingRequests.length ? "awaiting review" : "all clear", Icon: FileClock, tone: "bg-amber-50 text-amber-600",
    },
  ];

  /* selected-day helpers */
  const sd = selectedDay;
  const sdStyle = sd ? DAY_STYLE[sd.status] || DAY_STYLE.none : null;
  const sdDate = sd ? new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), sd.day) : null;
  const sdExisting = sd ? myRequests.find((r) => r.date === sd.dateStr && r.status === "Pending") : null;
  const sdPast = sd ? myRequests.find((r) => r.date === sd.dateStr && r.status !== "Pending") : null;
  const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");

  return (
    <div className={`relative min-h-screen ${PAGE_BG} pb-16`}>
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">

        {/* ================= HEADER ================= */}
        <header className="relative z-30 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
              <GreetIcon size={16} /> {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
              {greeting}, {firstName}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">Here's your day at a glance.</p>
          </div>

          <div className="relative shrink-0">
            <motion.button
              onClick={() => setShowBellMenu(!showBellMenu)}
              whileTap={{ scale: 0.94 }}
              aria-label={`Notifications${unseenCount ? `, ${unseenCount} unread` : ""}`}
              className={`relative flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition ${showBellMenu ? "bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-red-600/30" : "bg-white/90 text-gray-600 ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200"}`}
            >
              <Bell size={20} />
              <AnimatePresence>
                {unseenCount > 0 && (
                  <motion.span key={unseenCount} initial={{ scale: 0.4 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white ring-2 ring-white">
                    {unseenCount > 99 ? "99+" : unseenCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            <AnimatePresence>
              {showBellMenu && (
                <>
                  <div className="fixed inset-0 z-[90]" onClick={() => setShowBellMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="absolute right-0 z-[100] mt-3 w-[calc(100vw-2rem)] max-w-[400px] origin-top-right overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-12px_rgba(127,29,29,0.35)] ring-1 ring-gray-100"
                  >
                    <div className="relative bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-5 text-white">
                      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
                      <div className="relative flex items-center justify-between">
                        <div>
                          <p className="text-base font-extrabold">Notifications</p>
                          <p className="text-xs text-white/80">{unseenCount ? `${unseenCount} unread` : "You're all caught up"}</p>
                        </div>
                        <button onClick={() => setShowBellMenu(false)} aria-label="Close" className="rounded-full bg-white/15 p-1.5 ring-1 ring-white/25 hover:bg-white/25"><X size={15} /></button>
                      </div>
                      <div className="relative mt-4 grid grid-cols-3 gap-2">
                        {[["Upcoming", annCounts.upcoming], ["Ongoing", annCounts.ongoing], ["Done", annCounts.done]].map(([l, v]) => (
                          <div key={l} className="rounded-xl bg-white/15 p-2 text-center ring-1 ring-white/20">
                            <p className="text-lg font-extrabold leading-none tabular-nums">{v}</p>
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/80">{l}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="max-h-[360px] space-y-1 overflow-y-auto p-3">
                      {notifications.length > 0 && (
                        <>
                          <p className="px-2 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Leave & attendance updates</p>
                          {notifications.map((n) => (
                            <button key={n._id} onClick={() => handleNotificationClick(n)}
                              className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${n.seen ? "opacity-60 hover:bg-gray-50" : "bg-red-50/70 hover:bg-red-50"}`}>
                              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${n.type === "leave-status" ? "bg-violet-100 text-violet-600" : "bg-sky-100 text-sky-600"}`}>
                                {n.type === "leave-status" ? <Umbrella size={15} /> : <CalendarCheck2 size={15} />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-gray-800">{n.message}</span>
                                <span className="block text-[11px] text-gray-400">{new Date(n.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                              </span>
                              {!n.seen && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                            </button>
                          ))}
                        </>
                      )}
                      {announcements.length > 0 && (
                        <>
                          <p className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">Announcements</p>
                          {announcements.map((a) => {
                            const isRead = a.seenBy?.map((id) => id.toString()).includes(uid);
                            return (
                              <button key={a._id} onClick={() => openAnnouncement(a)}
                                className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${isRead ? "opacity-60 hover:bg-gray-50" : "bg-red-50/70 hover:bg-red-50"}`}>
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600"><Megaphone size={15} /></span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-gray-800">{a.title}</span>
                                  <span className="block text-[11px] text-gray-400">{a.type}</span>
                                </span>
                                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${getStatusBadge(a.status)}`}>{a.status}</span>
                                {!isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                              </button>
                            );
                          })}
                        </>
                      )}
                      {announcements.length === 0 && notifications.length === 0 && (
                        <div className="py-10 text-center"><Bell size={26} className="mx-auto text-gray-200" /><p className="mt-2 text-sm text-gray-400">No notices or leave updates</p></div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* ================= PUNCH ================= */}
        <EmployeePunch onSuccess={handleAttendanceSuccess} />

        {/* ================= QUICK STATS ================= */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STAT_CARDS.map((s, i) => {
            const Tag = s.onClick ? motion.button : motion.div;
            return (
              <Tag key={s.key} type={s.onClick ? "button" : undefined} onClick={s.onClick}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}
                className={`${CARD} group relative overflow-hidden p-4 text-left sm:p-5 ${s.onClick ? "transition hover:-translate-y-0.5 hover:ring-red-200" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.tone}`}><s.Icon size={17} /></div>
                  {s.onClick && <ArrowRight size={15} className="text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-red-500" />}
                </div>
                <p className="mt-3 text-2xl font-extrabold tabular-nums text-gray-900 sm:text-3xl">{s.value}</p>
                <p className="text-xs font-semibold text-gray-500">{s.label}</p>
                {s.suffix && <p className="mt-0.5 truncate text-[11px] text-gray-400">{s.suffix}</p>}
              </Tag>
            );
          })}
        </div>

        {/* ================= CALENDAR + SIDE ================= */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Calendar */}
          <section id="attendance-calendar-section" className={`${CARD} scroll-mt-6 p-4 sm:p-6 lg:col-span-2`}>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow shadow-red-600/30"><CalendarDays size={18} /></div>
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight text-gray-900">Attendance</h2>
                  <p className="text-xs text-gray-500">Tap a day to see details or request a correction</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {!isCurrentMonth && (
                  <button onClick={() => setCalendarMonth(new Date())} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 ring-1 ring-red-100 hover:bg-red-100">Today</button>
                )}
                <div className="flex items-center gap-1 rounded-2xl bg-gray-50 p-1 ring-1 ring-gray-100">
                  <button onClick={() => setCalendarMonth(p => new Date(p.getFullYear(), p.getMonth() - 1, 1))} aria-label="Previous month"
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-500 hover:bg-white hover:text-red-600 hover:shadow-sm"><ChevronLeft size={17} /></button>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={calendarMonth.toISOString()} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                      className="w-32 text-center text-sm font-bold text-gray-900">
                      {calendarMonth.toLocaleString("en-IN", { month: "long", year: "numeric" })}
                    </motion.span>
                  </AnimatePresence>
                  <button onClick={() => setCalendarMonth(p => new Date(p.getFullYear(), p.getMonth() + 1, 1))} aria-label="Next month"
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-500 hover:bg-white hover:text-red-600 hover:shadow-sm"><ChevronRight size={17} /></button>
                </div>
              </div>
            </div>

            {/* month summary */}
            <div className="mb-4 grid grid-cols-5 gap-2">
              {[["present", "Present"], ["halfday", "Half day"], ["absent", "Absent"], ["leave", "Leave"], ["holiday", "Holiday"]].map(([k, l]) => (
                <div key={k} className="rounded-2xl bg-gray-50 p-2 text-center ring-1 ring-gray-100 sm:p-3">
                  <p className="text-lg font-extrabold leading-none tabular-nums text-gray-900 sm:text-xl">{monthStats[k]}</p>
                  <p className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-gray-500 sm:text-[11px]">
                    <span className={`hidden h-2 w-2 rounded-full sm:inline-block ${DAY_STYLE[k].dot}`} />{l}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 pb-1.5 sm:gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                <div key={d} className={`text-center text-[10px] font-bold uppercase tracking-wider sm:text-[11px] ${i === 0 || i === 6 ? "text-red-400" : "text-gray-400"}`}>{d}</div>
              ))}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={calendarMonth.toISOString()} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}
                className="grid grid-cols-7 gap-1 sm:gap-2">
                {generateCalendar().map((day, i) => {
                  if (!day) return <div key={i} />;
                  const { status, title } = getDayInfo(day);
                  const st = DAY_STYLE[status] || DAY_STYLE.none;
                  const ds = toYMD(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
                  const isToday = ds === todayStr;
                  const isFuture = ds > todayStr;
                  const pending = pendingOn(ds);
                  return (
                    <button key={i} type="button" onClick={() => handleDayClick(day)} title={title}
                      className={`relative flex aspect-square flex-col items-center justify-center rounded-xl p-1 transition hover:-translate-y-0.5 active:scale-95 sm:aspect-auto sm:min-h-[4.75rem] sm:rounded-2xl ${st.cell} ${isFuture && status === "none" ? "opacity-60" : ""} ${isToday ? "ring-2 ring-red-500 ring-offset-2" : ""}`}>
                      <span className="text-sm font-extrabold leading-none sm:text-lg">{day}</span>
                      {title && status !== "none" && status !== "weekend" && (
                        <span className="mt-1 hidden max-w-full truncate px-1 text-[10px] font-semibold leading-tight opacity-90 sm:block">{title}</span>
                      )}
                      {status === "working" && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
                      {pending && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-white ring-2 ring-white" title="Correction pending"><Clock3 size={9} strokeWidth={3} /></span>}
                      {isToday && <span className="absolute bottom-1 hidden text-[8px] font-bold uppercase tracking-wider opacity-80 sm:block">{status === "none" ? "Today" : ""}</span>}
                    </button>
                  );
                })}
              </motion.div>
            </AnimatePresence>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-gray-100 pt-4 text-[11px] font-semibold text-gray-500">
              {["present", "halfday", "absent", "working", "leave", "holiday", "weekend"].map((k) => (
                <span key={k} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded ${DAY_STYLE[k].dot}`} />{DAY_STYLE[k].label}</span>
              ))}
              <span className="flex items-center gap-1.5"><span className="flex h-3 w-3 items-center justify-center rounded-full bg-amber-400 text-white"><Clock3 size={7} strokeWidth={3} /></span>Correction pending</span>
            </div>
          </section>

          {/* Side column */}
          <div className="flex flex-col gap-6">
            {/* Team */}
            <Widget icon={Activity} title="My team" live
              subtitle={team.department?.name ? `${team.department.name}${team.totalMembers > 0 ? ` · ${team.totalMembers} ${team.totalMembers === 1 ? "person" : "people"}` : ""}` : undefined}
              className="h-[22rem]">
              {team.status === "loading" && (
                <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="flex animate-pulse items-center gap-3 p-2"><div className="h-9 w-9 rounded-full bg-gray-100" /><div className="flex-1 space-y-1.5"><div className="h-3 w-2/3 rounded bg-gray-100" /><div className="h-2.5 w-1/3 rounded bg-gray-50" /></div></div>)}</div>
              )}
              {team.status === "error" && (
                <div className="flex h-full min-h-[8rem] flex-col items-center justify-center gap-2 text-center">
                  <AlertTriangle size={22} className="text-red-400" />
                  <span className="text-xs font-semibold text-red-600">{team.error}</span>
                  <button onClick={retryTeam} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-200"><RefreshCw size={12} /> Retry</button>
                </div>
              )}
              {team.status === "ok" && team.managerStatus === "no_department" && <Empty icon={Users} text="Department not assigned" />}
              {team.status === "ok" && team.managerStatus !== "no_department" && (
                <>
                  {team.manager ? (
                    <TeamPersonRow person={team.manager} isManager />
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 p-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-300"><Users size={14} /></div>
                      <span className="text-sm font-semibold text-gray-400">Manager not assigned</span>
                    </div>
                  )}
                  {team.members.map((m) => <TeamPersonRow key={m.employeeRecordId || m.userId} person={m} />)}
                  {team.members.length === 0 && <p className="py-3 text-center text-xs font-semibold text-gray-300">No other team members yet</p>}
                  {team.hasMore && <p className="py-1 text-center text-[11px] text-gray-400">Showing the first {team.members.length} members</p>}
                </>
              )}
            </Widget>

            {/* Holidays */}
            <Widget icon={CalendarDays} tone="bg-rose-50 text-rose-600" title="Upcoming holidays" subtitle={upcomingHolidays.length ? `${upcomingHolidays.length} ahead` : undefined} className="h-[18rem]">
              {upcomingHolidays.length ? upcomingHolidays.map((h, i) => {
                const d = new Date(h.date);
                const n = daysTo(h.date);
                return (
                  <div key={h._id} className={`flex items-center gap-3 rounded-2xl p-2 ${i === 0 ? "bg-rose-50/70 ring-1 ring-rose-100" : "hover:bg-gray-50"}`}>
                    <div className="flex h-11 w-11 shrink-0 flex-col overflow-hidden rounded-xl bg-white text-center leading-none shadow-sm ring-1 ring-gray-100">
                      <span className="bg-gradient-to-r from-red-600 to-rose-500 py-0.5 text-[8px] font-bold uppercase text-white">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
                      <span className="flex flex-1 items-center justify-center text-base font-extrabold text-gray-900">{d.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{h.title}</p>
                      <p className="text-xs text-gray-400">{d.toLocaleDateString("en-IN", { weekday: "long" })}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${n === 0 ? "bg-red-600 text-white" : n <= 7 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100" : "bg-gray-50 text-gray-500"}`}>
                      {n === 0 ? "Today" : n === 1 ? "Tomorrow" : `${n}d`}
                    </span>
                  </div>
                );
              }) : <Empty icon={CalendarDays} text="No upcoming holidays" />}
            </Widget>
          </div>
        </div>

        {/* ================= PEOPLE + NEWS ================= */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {/* Birthdays */}
          <Widget icon={Cake} tone="bg-pink-50 text-pink-600" title="Birthdays" live={!!birthdays.today?.length} className="h-[20rem]">
            {birthdays.today?.map((emp) => (
              <div key={emp._id} className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 p-2.5 text-white shadow-lg shadow-red-600/25">
                <div className="pointer-events-none absolute -right-4 -top-6 h-16 w-16 rounded-full bg-white/20 blur-xl" />
                <Avatar path={emp.userId?.profileImage || emp.profileImage} name={personName(emp)} ring="ring-2 ring-white/50" />
                <div className="relative min-w-0">
                  <p className="truncate text-sm font-bold">{personName(emp)}</p>
                  <p className="text-xs text-white/85">Birthday today 🎉</p>
                </div>
              </div>
            ))}
            {birthdays.upcoming?.map((emp) => {
              // Employees get `monthDay` only; admins may still get `dob`.
              let daysLeft = daysUntilMonthDay(emp.monthDay);
              if (daysLeft === null && emp.dob) {
                const dob = new Date(emp.dob);
                if (!isNaN(dob.getTime())) {
                  const md = `${String(dob.getMonth() + 1).padStart(2, "0")}-${String(dob.getDate()).padStart(2, "0")}`;
                  daysLeft = daysUntilMonthDay(md);
                }
              }
              return (
                <PersonRow key={emp._id} path={emp.userId?.profileImage || emp.profileImage} name={personName(emp)}
                  sub={formatMonthDay(emp.monthDay, emp.dob)}
                  right={daysLeft !== null && daysLeft > 0 ? <span className="shrink-0 rounded-full bg-pink-50 px-2 py-0.5 text-[11px] font-bold text-pink-600">{daysLeft === 1 ? "Tomorrow" : `${daysLeft}d`}</span> : null} />
              );
            })}
            {!birthdays.today?.length && !birthdays.upcoming?.length && <Empty icon={Cake} text="No birthdays this week" />}
          </Widget>

          {/* Anniversaries */}
          <Widget icon={Award} tone="bg-amber-50 text-amber-600" title="Work anniversaries" live={!!anniversaries.today?.length} className="h-[20rem]">
            {anniversaries.today?.map((emp) => (
              <div key={emp._id} className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-orange-400 p-2.5 text-white shadow-lg shadow-amber-500/25">
                <Avatar path={emp.userId?.profileImage || emp.profileImage} name={personName(emp)} ring="ring-2 ring-white/50" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{personName(emp)}</p>
                  <p className="text-xs text-white/90">{emp.years || getYearsJoined(emp.joiningDate)}-year anniversary 🥂</p>
                </div>
              </div>
            ))}
            {anniversaries.upcoming?.map((emp) => (
              <PersonRow key={emp._id} path={emp.userId?.profileImage || emp.profileImage} name={personName(emp)}
                sub={formatMonthDay(emp.monthDay, emp.joiningDate)}
                right={emp.years ? <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">{emp.years} yr</span> : null} />
            ))}
            {!anniversaries.today?.length && !anniversaries.upcoming?.length && <Empty icon={Award} text="No milestones soon" />}
          </Widget>

          {/* New joiners */}
          <Widget icon={UserPlus} tone="bg-emerald-50 text-emerald-600" title="Joined recently" className="h-[20rem]">
            {newEmployees.length > 0 ? newEmployees.map((e) => (
              <PersonRow key={e._id} path={e.profileImage} name={personName(e)} sub={joinedLabel(e)}
                right={<span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">New</span>} />
            )) : <Empty icon={Users} text="No new joiners" />}
          </Widget>

          {/* Announcements */}
          <Widget icon={Megaphone} title="Announcements" subtitle={unseenAnnouncements ? `${unseenAnnouncements} unread` : undefined} className="h-[20rem]">
            {announcements.length ? announcements.map((a) => {
              const isRead = a.seenBy?.map((id) => id.toString()).includes(uid);
              return (
                <button key={a._id} onClick={() => openAnnouncement(a)}
                  className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition ${isRead ? "hover:bg-gray-50" : "bg-red-50/70 ring-1 ring-red-100 hover:bg-red-50"}`}>
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl">
                    {a.image
                      ? <img src={getImageUrl(a.image)} alt="" className="h-full w-full object-cover" onError={(ev) => { ev.currentTarget.style.display = "none"; }} />
                      : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-red-100 to-rose-200 text-red-500"><Megaphone size={15} /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${isRead ? "font-semibold text-gray-700" : "font-bold text-gray-900"}`}>{a.title}</p>
                    <p className="truncate text-xs text-gray-400">{a.type}{a.date ? ` · ${new Date(a.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}</p>
                  </div>
                  {!isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                </button>
              );
            }) : <Empty icon={Megaphone} text="No announcements" />}
          </Widget>
        </div>
      </div>

      {/* ================= TOAST ================= */}
      {createPortal(
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              className="fixed inset-x-0 bottom-5 z-[260] flex justify-center px-4">
              <div className="flex items-center gap-3 rounded-2xl bg-gray-900 py-3 pl-4 pr-2 text-sm font-semibold text-white shadow-2xl">
                <CheckCircle2 size={18} className="text-emerald-400" /> {toast}
                <button onClick={() => setToast("")} aria-label="Dismiss" className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"><X size={15} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <AnimatePresence>
        {/* ================= ANNOUNCEMENT MODAL ================= */}
        {activeAnnouncement && (
          <Modal key="ann" onClose={() => setActiveAnnouncement(null)} size="max-w-2xl">
            <div className="relative h-56 shrink-0 overflow-hidden sm:h-72">
              {activeAnnouncement.image
                ? <img src={getImageUrl(activeAnnouncement.image)} alt="" className="h-full w-full object-cover" />
                : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-red-600 via-rose-600 to-rose-500"><Megaphone size={72} className="text-white/30" /></div>}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <button onClick={() => setActiveAnnouncement(null)} aria-label="Close"
                className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/30"><X size={18} /></button>
              <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${getStatusBadge(activeAnnouncement.status)}`}>{activeAnnouncement.status}</span>
                  {activeAnnouncement.type && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-white/30">{activeAnnouncement.type}</span>}
                </div>
                <h2 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{activeAnnouncement.title}</h2>
              </div>
            </div>
            <div className="overflow-y-auto p-6">
              {(activeAnnouncement.date || activeAnnouncement.venue) && (
                <div className="mb-4 flex flex-wrap gap-3">
                  {activeAnnouncement.date && <span className="inline-flex items-center gap-1.5 rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-100"><CalendarDays size={15} className="text-red-500" />{new Date(activeAnnouncement.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</span>}
                  {activeAnnouncement.venue && <span className="inline-flex items-center gap-1.5 rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-100"><MapPin size={15} className="text-red-500" />{activeAnnouncement.venue}</span>}
                </div>
              )}
              <p className="whitespace-pre-line text-base leading-relaxed text-gray-600">{activeAnnouncement.description || "No details provided."}</p>
            </div>
          </Modal>
        )}

        {/* ================= LEAVE MODAL ================= */}
        {showLeaveBreakdown && (
          <Modal key="leave" onClose={() => setShowLeaveBreakdown(false)}>
            <div className="relative shrink-0 bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 px-6 pb-6 pt-7 text-center text-white">
              <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
              <button onClick={() => setShowLeaveBreakdown(false)} aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/15 p-1.5 ring-1 ring-white/25 hover:bg-white/25"><X size={16} /></button>
              <p className="relative text-[11px] font-semibold uppercase tracking-wider text-white/80">Leave left this year</p>
              <p className="relative mt-1 text-6xl font-extrabold leading-none tabular-nums">{totalLeft}</p>
              <p className="relative mt-1 text-sm text-white/85">of {totalQuota} days</p>
            </div>
            <div className="space-y-3 overflow-y-auto p-6">
              {[
                { label: "Casual leave", left: leaveBalance.casual, total: TOTAL_ANNUAL_CASUAL, bar: "bg-violet-500", bg: "bg-violet-50/70 ring-violet-100", text: "text-violet-700" },
                { label: "Sick leave", left: leaveBalance.sick, total: TOTAL_ANNUAL_SICK, bar: "bg-rose-500", bg: "bg-rose-50/70 ring-rose-100", text: "text-rose-700" },
              ].map((b) => {
                const used = b.total - b.left;
                return (
                  <div key={b.label} className={`rounded-2xl p-4 ring-1 ${b.bg}`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-bold ${b.text}`}>{b.label}</p>
                      <p className="text-sm text-gray-500"><b className="text-xl font-extrabold tabular-nums text-gray-900">{b.left}</b> / {b.total} left</p>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${b.total ? (b.left / b.total) * 100 : 0}%` }} transition={{ duration: 0.8 }} className={`h-full rounded-full ${b.bar}`} />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">{used} day{used === 1 ? "" : "s"} used</p>
                  </div>
                );
              })}
              <p className="flex items-start gap-1.5 text-xs text-gray-400"><Sparkles size={13} className="mt-px shrink-0" /> Approved leaves are deducted automatically. Weekends and holidays don't count.</p>
              <Link to={`/employee-dashboard/leaves/${user._id}`} onClick={() => setShowLeaveBreakdown(false)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110">
                Go to my leaves <ArrowRight size={15} />
              </Link>
            </div>
          </Modal>
        )}

        {/* ================= DAY DETAIL / CORRECTION ================= */}
        {sd && (
          <Modal key="day" onClose={() => setSelectedDay(null)}>
            <div className={`relative shrink-0 px-6 pb-5 pt-7 ${["present", "halfday", "absent", "working", "leave"].includes(sd.status) ? sdStyle.cell.split(" ").filter((c) => c.startsWith("bg-") || c.startsWith("text-")).join(" ") : "bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 text-white"}`}>
              <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
              <button onClick={() => setSelectedDay(null)} aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/20 p-1.5 ring-1 ring-white/30 hover:bg-white/30"><X size={16} /></button>
              <p className="relative text-xs font-semibold uppercase tracking-wider opacity-80">
                {sdDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <h3 className="relative mt-1 text-2xl font-extrabold tracking-tight">{sd.title || "Attendance detail"}</h3>
            </div>

            <div className="space-y-4 overflow-y-auto p-6">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Check-in", fmtTime(sd.record?.checkIn), Clock, "text-emerald-600"],
                  ["Check-out", fmtTime(sd.record?.checkOut), Clock, "text-red-600"],
                  ["Worked", sd.record?.workedHours ? `${Number(sd.record.workedHours).toFixed(1)} h` : "—", Timer, "text-sky-600"],
                ].map(([l, v, Icon, c]) => (
                  <div key={l} className="rounded-2xl bg-gray-50 p-3 text-center ring-1 ring-gray-100">
                    <Icon size={15} className={`mx-auto ${c}`} />
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{l}</p>
                    <p className="text-sm font-bold text-gray-900">{v}</p>
                  </div>
                ))}
              </div>

              {sdPast && !sdExisting && (
                <p className={`flex items-center gap-2 rounded-2xl p-3 text-xs font-semibold ring-1 ${sdPast.status === "Approved" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-red-50 text-red-700 ring-red-100"}`}>
                  {sdPast.status === "Approved" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  Earlier correction to {sdPast.requestedStatus} was {sdPast.status.toLowerCase()}.
                </p>
              )}

              {sdExisting ? (
                <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-white"><Clock3 size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-amber-900">Correction to {sdExisting.requestedStatus} — {sdExisting.status}</p>
                      {sdExisting.reason && <p className="mt-0.5 text-xs text-amber-800/80">“{sdExisting.reason}”</p>}
                    </div>
                  </div>
                  <button onClick={() => deleteRequest(sdExisting)} disabled={deletingRequest}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-bold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 disabled:opacity-50">
                    {deletingRequest ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} {deletingRequest ? "Withdrawing…" : "Withdraw request"}
                  </button>
                </div>
              ) : ["absent", "halfday"].includes(sd.status) ? (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-bold text-gray-900">Request a correction</p>
                  <p className="text-xs text-gray-500">Your manager will review it.</p>
                  <p className="mb-1.5 mt-3 text-xs font-semibold text-gray-600">Change to</p>
                  <div className="flex gap-1 rounded-2xl bg-gray-100/80 p-1">
                    {["Present", "Half Day"].map(opt => (
                      <button key={opt} type="button" onClick={() => setRequestForm(f => ({ ...f, requestedStatus: opt }))}
                        className={`relative flex-1 rounded-xl py-2 text-sm font-bold transition ${requestForm.requestedStatus === opt ? "text-white" : "text-gray-500 hover:text-gray-800"}`}>
                        {requestForm.requestedStatus === opt && <motion.span layoutId="req-status" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25" />}
                        <span className="relative">{opt}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mb-1.5 mt-3 flex items-center justify-between">
                    <label htmlFor="req-reason" className="text-xs font-semibold text-gray-600">Reason <span className="text-red-500">*</span></label>
                    <span className="text-[11px] tabular-nums text-gray-400">{requestForm.reason.length}/300</span>
                  </div>
                  <textarea id="req-reason" value={requestForm.reason} maxLength={300}
                    onChange={(e) => { setRequestForm(f => ({ ...f, reason: e.target.value })); setRequestError(""); }}
                    placeholder="e.g. Forgot to punch out — was in the client meeting till 6 PM"
                    rows={3}
                    className="w-full resize-none rounded-2xl border-0 bg-white p-3 text-sm text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-400" />
                  {requestError && <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-600"><AlertTriangle size={12} />{requestError}</p>}
                  <button onClick={handleRequestSubmit} disabled={submittingRequest || !requestForm.reason.trim()}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
                    {submittingRequest ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {submittingRequest ? "Submitting…" : "Submit request"}
                  </button>
                </div>
              ) : (
                <p className="rounded-2xl bg-gray-50 p-3 text-center text-xs text-gray-400 ring-1 ring-gray-100">
                  {sd.status === "holiday" ? "Company holiday — enjoy the day off." : sd.status === "weekend" ? "Weekend — no attendance needed." : sd.status === "leave" ? "You were on approved leave." : sd.status === "present" ? "Marked present. Nothing to correct." : "Corrections can be requested for absent or half days."}
                </p>
              )}
              {requestError && sdExisting && <p className="flex items-center gap-1 text-xs font-semibold text-red-600"><AlertTriangle size={12} />{requestError}</p>}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmployeeSummary;