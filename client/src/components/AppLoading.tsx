type AppLoadingProps = {
  fullScreen?: boolean;
  label?: string;
};

export function AppLoading({ fullScreen = false, label = 'กำลังโหลดข้อมูล' }: AppLoadingProps) {
  return (
    <div
      className={`grid place-items-center bg-[#091426] px-4 text-white ${
        fullScreen ? 'min-h-screen' : 'min-h-[56vh] rounded-2xl'
      }`}
    >
      <div className="flex w-full max-w-[280px] animate-in fade-in slide-in-from-bottom-4 duration-500 flex-col items-center text-center">
        <svg className="mb-6 h-20 w-20 animate-[splash-pulse_2s_ease-in-out_infinite]" viewBox="0 0 64 64" role="img" aria-label="ShipTrack">
          <path d="M 35.0 9.2 A 23 23 0 0 1 53.2 40.8" fill="none" stroke="#5f738c" strokeWidth="4.5" strokeLinecap="butt" />
          <path d="M 50.3 46.0 A 23 23 0 0 1 13.7 46.0" fill="none" stroke="#5f738c" strokeWidth="4.5" strokeLinecap="butt" />
          <path d="M 10.8 40.8 A 23 23 0 0 1 29.0 9.2" fill="none" stroke="#5f738c" strokeWidth="4.5" strokeLinecap="butt" />
          <path d="M 18.5 41.5 L 32 20 L 45.5 41.5" fill="none" stroke="#06b6d4" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="butt" />
        </svg>
        <p className="font-display text-2xl font-black leading-tight text-sky-300">ShipTrack</p>
        <p className="mt-2 text-sm font-semibold text-slate-300">{label}</p>
        <div className="mt-8 h-10 w-10 animate-spin rounded-full border-[3px] border-cyan-400/15 border-t-cyan-400" aria-hidden="true" />
      </div>
    </div>
  );
}

export default AppLoading;
