import { useAuth } from "../context/authContext";

// Shown when a saved token exists but could not be verified (network / 5xx)
// and no cached user snapshot is available. The token is kept.
const SessionUnavailable = () => {
  const { sessionError, retryVerify, logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F3EC] px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white border border-[#E7E1D3] p-8 text-center shadow-sm">
        <h1 className="text-lg font-black tracking-tight text-[#1C1A17] mb-2">Can't verify your session</h1>
        <p className="text-[13px] text-[#8A8478] mb-6">
          {sessionError || "The server could not be reached."} You are still signed in on this device.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={retryVerify}
            className="w-full py-3 rounded-xl bg-[#1C1A17] text-[#F6F3EC] text-[12px] font-bold uppercase tracking-widest"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={logout}
            className="w-full py-3 rounded-xl border border-[#E7E1D3] text-[#7A2233] text-[12px] font-bold uppercase tracking-widest"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionUnavailable;
