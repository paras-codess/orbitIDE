import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";

function App() {
  return (
    <div className="app">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          {/* Future routes will be added here in later phases */}
          {/* <Route path="/problems" element={<Problems />} /> */}
          {/* <Route path="/ide" element={<IDE />} /> */}
          {/* <Route path="/contests" element={<Contests />} /> */}
          {/* <Route path="/visualizer" element={<Visualizer />} /> */}
        </Routes>
      </main>
    </div>
  );
}

export default App;
