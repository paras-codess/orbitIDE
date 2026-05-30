import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { problemsAPI } from "../services/api.js";
import "./Problems.css";

function Problems() {
  // Filter and pagination state
  const [problems, setProblems] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [topic, setTopic] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProblems, setTotalProblems] = useState(0);
  const limit = 10;

  // Fetch topics list on mount
  useEffect(() => {
    problemsAPI
      .getTopics()
      .then((res) => {
        if (res.status === "success") {
          setTopics(res.data);
        }
      })
      .catch((err) => {
        console.error("Failed to load topics:", err);
      });
  }, []);

  // Debounce search term update
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on search change
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  // Fetch problems when filters or page changes
  const fetchProblems = useCallback(() => {
    setLoading(true);
    problemsAPI
      .getProblems({
        page,
        limit,
        difficulty,
        topic,
        search: debouncedSearch,
      })
      .then((res) => {
        if (res.status === "success") {
          setProblems(res.data.problems);
          setTotalPages(res.data.pagination.totalPages);
          setTotalProblems(res.data.pagination.total);
          setError(null);
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load problems.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [page, difficulty, topic, debouncedSearch]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchProblems();
    });
  }, [fetchProblems]);

  // Handle difficulty filter toggle
  const handleDifficultyClick = (diff) => {
    setDifficulty((prev) => (prev === diff ? "" : diff));
    setPage(1); // Reset to page 1
  };

  // Handle topic change
  const handleTopicChange = (e) => {
    setTopic(e.target.value);
    setPage(1); // Reset to page 1
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearch("");
    setDifficulty("");
    setTopic("");
    setPage(1);
  };

  // Render pagination buttons helper
  const renderPaginationButtons = () => {
    const buttons = [];
    const maxVisible = 5;
    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          className={`page-btn ${page === i ? "active" : ""}`}
          onClick={() => setPage(i)}
        >
          {i}
        </button>
      );
    }
    return buttons;
  };

  return (
    <div className="problems-page container">
      {/* Page Header */}
      <header className="problems-header">
        <h1>Practice Problems</h1>
        <p>
          Sharpen your coding skills, master data structures and algorithms, and prepare for interviews with our curated problem set.
        </p>
      </header>

      {/* Main Layout Grid */}
      <div className="problems-layout">
        {/* Sidebar Filters */}
        <aside className="problems-sidebar glass-card">
          <h2 className="filter-title">Filters</h2>

          {/* Search Box */}
          <div className="filter-group">
            <label htmlFor="problem-search">Search</label>
            <div className="search-wrapper">
              <span className="search-icon">🔍</span>
              <input
                id="problem-search"
                type="text"
                className="search-input"
                placeholder="Search problems..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Difficulty Filters */}
          <div className="filter-group">
            <label>Difficulty</label>
            <div className="difficulty-chips">
              <button
                className={`chip-btn ${difficulty === "EASY" ? "active-easy" : ""}`}
                onClick={() => handleDifficultyClick("EASY")}
              >
                <span>Easy</span>
                <span className="chip-dot easy"></span>
              </button>
              <button
                className={`chip-btn ${difficulty === "MEDIUM" ? "active-medium" : ""}`}
                onClick={() => handleDifficultyClick("MEDIUM")}
              >
                <span>Medium</span>
                <span className="chip-dot medium"></span>
              </button>
              <button
                className={`chip-btn ${difficulty === "HARD" ? "active-hard" : ""}`}
                onClick={() => handleDifficultyClick("HARD")}
              >
                <span>Hard</span>
                <span className="chip-dot hard"></span>
              </button>
            </div>
          </div>

          {/* Topic Filters */}
          <div className="filter-group">
            <label htmlFor="topic-dropdown">Topic</label>
            <div className="select-wrapper">
              <select
                id="topic-dropdown"
                className="topic-select"
                value={topic}
                onChange={handleTopicChange}
              >
                <option value="">All Topics</option>
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="select-arrow">▼</span>
            </div>
          </div>

          {/* Clear Filters Button */}
          {(search || difficulty || topic) && (
            <button
              className="btn-secondary clear-filters-btn"
              onClick={handleClearFilters}
            >
              Reset All Filters
            </button>
          )}
        </aside>

        {/* Problems List Panel */}
        <main className="problems-list-panel glass-card">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading problems...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p className="gradient-text">{error}</p>
              <button className="btn-primary" onClick={fetchProblems}>
                Retry
              </button>
            </div>
          ) : problems.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">📋</span>
              <h3>No Problems Found</h3>
              <p>Try adjusting your search criteria or filters.</p>
              {(search || difficulty || topic) && (
                <button
                  className="btn-primary"
                  style={{ marginTop: "1rem" }}
                  onClick={handleClearFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Problem Table */}
              <div className="table-container">
                <table className="problems-table">
                  <thead>
                    <tr>
                      <th style={{ width: "60%" }}>Problem Title</th>
                      <th style={{ width: "20%" }}>Difficulty</th>
                      <th style={{ width: "20%" }}>Topic</th>
                    </tr>
                  </thead>
                  <tbody>
                    {problems.map((prob) => (
                      <tr key={prob.id}>
                        <td className="problem-title-cell">
                          <Link to={`/problems/${prob.id}`} className="problem-link">
                            {prob.title}
                          </Link>
                        </td>
                        <td>
                          <span className={`difficulty-badge ${prob.difficulty.toLowerCase()}`}>
                            {prob.difficulty.toLowerCase()}
                          </span>
                        </td>
                        <td>
                          <span className="topic-badge">{prob.topic}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="pagination-container">
                  <div className="pagination-info">
                    Showing {(page - 1) * limit + 1} -{" "}
                    {Math.min(page * limit, totalProblems)} of {totalProblems} problems
                  </div>
                  <div className="pagination-controls">
                    <button
                      className="page-btn"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Prev
                    </button>
                    {renderPaginationButtons()}
                    <button
                      className="page-btn"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default Problems;
