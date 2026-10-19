import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Images } from "lucide-react";
import {
  ClientStandingsEditor,
  SharedGalleryManager,
} from "./ClientMediaAdmin";

const ClientContentAdmin = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => navigate(id ? `/admin-dashboard/clients/${id}` : "/admin-dashboard/clients")}
          className="mb-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:text-red-600"
        >
          <ArrowLeft size={16} /> Back to client
        </button>

        <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 p-6 text-white shadow-xl sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <Images size={22} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Client content</p>
              <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">
                Gallery &amp; standings
              </h1>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm text-white/70">
            Manage the monthly highlight gallery and {id ? "this client's performance standings." : "performance standings shared with all clients."}
          </p>
        </header>

        <div className="mt-6 space-y-6">
          <SharedGalleryManager />
          <ClientStandingsEditor clientId={id} />
        </div>
      </div>
    </main>
  );
};

export default ClientContentAdmin;
