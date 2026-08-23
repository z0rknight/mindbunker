import { clientLogoutAction } from "@/app/client/login/actions";

export function LogoutButton() {
  return (
    <form action={clientLogoutAction}>
      <button
        type="submit"
        className="min-h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 text-xs font-bold text-zinc-300 transition hover:border-zinc-600 hover:text-white"
      >
        Log out
      </button>
    </form>
  );
}
