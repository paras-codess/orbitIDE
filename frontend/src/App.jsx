import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import ChooseUsername from "./pages/ChooseUsername.jsx";
import Problems from "./pages/Problems.jsx";
import ProblemWorkspace from "./pages/ProblemWorkspace.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Visualizer from "./pages/Visualizer.jsx";
import ContestList from "./pages/ContestList.jsx";
import ContestArena from "./pages/ContestArena.jsx";

function App() {
  return (
    <div className="app">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/choose-username" element={<ChooseUsername />} />
          <Route path="/problems" element={<Problems />} />
          <Route path="/problems/:id" element={<ProblemWorkspace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Dashboard />} />
          <Route path="/visualizer" element={<Visualizer />} />
          <Route path="/contests" element={<ContestList />} />
          <Route path="/contests/:id" element={<ContestArena />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
