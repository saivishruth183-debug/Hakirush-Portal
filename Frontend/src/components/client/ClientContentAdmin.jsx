import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Images, Loader2, Users, X } from "lucide-react";
import {
  ClientStandingsEditor,
  SharedGalleryManager,
} from "./ClientMediaAdmin";
import { apiErrorMessage } from "../../utils/apiError";

const BACKEND = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");

const ClientContentAdmin = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(id || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [pendingClientId, setPendingClientId] = useState("");

  useEffect(() => {
    let active = true;
    const loadClients = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(`${BACKEND}/api/client`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const list = (response.data?.clients || []).map((client) => ({
          id: client._id,
          name: client.userId?.name || "Unnamed client",
        }));
        if (active) {
          setClients(list);
          setSelectedClientId((currentId) => {
            const preferredId = id || currentId;
            return list.some((client) => client.id === preferredId) ? preferredId : "";
          });
        }
      } catch (err) {
        if (active) setError(apiErrorMessage(err, "Couldn't load clients."));
      } finally {
        if (active) setLoading(false);
      }
    };
    loadClients();
    return () => { active = false; };
  }, [id]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId),
    [clients, selectedClientId]
  );

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
            Manage the monthly highlight gallery shared with all clients, and update a selected client’s standings.
          </p>
        </header>

        {error ? (
          <p role="alert" className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-100">
            {error}
          </p>
        ) : loading ? (
          <div className="flex justify-center py-16 text-red-600"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="mt-2">
            <SharedGalleryManager />
            <section className="mt-6">
              {selectedClient ? (
                <>
                  {!id && (
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-slate-500">
                        Editing standings for <span className="font-bold text-slate-800">{selectedClient.name}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => { setPendingClientId(selectedClientId); setClientPickerOpen(true); }}
                        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:text-violet-700 hover:ring-violet-200"
                      >
                        <Users size={16} /> Change client
                      </button>
                    </div>
                  )}
                  <ClientStandingsEditor key={selectedClient.id} clientId={selectedClient.id} />
                </>
              ) : (
                <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
                  <p className="text-sm text-slate-500">Choose a client to view and edit their standings.</p>
                  <button
                    type="button"
                    onClick={() => setClientPickerOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700"
                  >
                    <Users size={16} /> Choose client
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {clientPickerOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="client-picker-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="client-picker-title" className="text-lg font-extrabold text-slate-900">Choose a client</h2>
                <p className="mt-1 text-sm text-slate-500">Select whose standings you want to edit.</p>
              </div>
              <button type="button" onClick={() => setClientPickerOpen(false)} aria-label="Close"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <label htmlFor="content-client" className="mt-5 block text-sm font-semibold text-slate-700">
              Client
            </label>
            <select
              id="content-client"
              value={pendingClientId}
              onChange={(event) => setPendingClientId(event.target.value)}
              className="mt-2 w-full rounded-xl bg-white px-3 py-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <option value="">Choose a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setClientPickerOpen(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button type="button" disabled={!pendingClientId}
                onClick={() => {
                  setSelectedClientId(pendingClientId);
                  setClientPickerOpen(false);
                }}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
                Open standings
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};

export default ClientContentAdmin;
