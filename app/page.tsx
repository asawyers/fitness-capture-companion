import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from './chatgpt-auth';
import { CaptureApp } from './capture-app';
export const dynamic = 'force-dynamic';
export default async function Home() {
    const user = await getChatGPTUser();
    return <div className="shell">
    <header className="app-header">
      <a href="/" className="brand" aria-label="Fitness Capture home"><span className="brand-mark" aria-hidden="true">≋</span><span>Fitness Capture<small>Meals & workouts, held for later.</small></span></a>
      {user && <a className="quiet-link" href={chatGPTSignOutPath('/')} target="_top">Sign out</a>}
    </header>
    {user ? <CaptureApp /> : <main className="welcome">
      <div className="welcome-symbol" aria-hidden="true">↳</div>
      <h1>Make a note.<br />Get on with your day.</h1>
      <p>Capture a meal or workout while it’s fresh. Review the details when you have time, then copy them into your tracking app.</p>
      <a className="button primary" href={chatGPTSignInPath('/')} target="_top">Sign in with ChatGPT</a>
      <p className="fine-print">Your entries are private to your account.<br />No nutrition estimates. Just what you recorded.</p>
      <div className="sample-note" aria-label="Example capture"><span>For example</span><p>2 eggs, toast<br />Squat 3 × 5 at 60 kg</p><small>Text or voice. You can fill in the gaps later.</small></div>
    </main>}
    <footer>Capture here. Calculate and log in your usual app.</footer>
  </div>;
}
