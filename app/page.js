export default function Home() {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080808; color: #f0f0f0; font-family: 'Georgia', serif; }
        .nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 48px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%);
        }
        .nav-logo { font-size: 15px; font-family: sans-serif; letter-spacing: 0.15em; text-transform: uppercase; color: #fff; text-decoration: none; font-weight: 600; }
        .nav-links { display: flex; gap: 32px; }
        .nav-links a { color: rgba(255,255,255,0.8); text-decoration: none; font-size: 13px; font-family: sans-serif; letter-spacing: 0.1em; text-transform: uppercase; transition: color 0.2s; }
        .nav-links a:hover { color: #fff; }
        .hero {
          position: relative; height: 100vh; min-height: 600px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; overflow: hidden;
        }
        .hero-bg {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 60% 40%, #1a1a2e
