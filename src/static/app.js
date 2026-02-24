document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const signupLockedBanner = document.getElementById("signup-locked");

  const userMenuButton = document.getElementById("user-menu-button");
  const authModal = document.getElementById("auth-modal");
  const authClose = document.getElementById("auth-close");
  const authForm = document.getElementById("auth-form");
  const authUsername = document.getElementById("auth-username");
  const authPassword = document.getElementById("auth-password");
  const authSubmit = document.getElementById("auth-submit");
  const authLogout = document.getElementById("auth-logout");
  const authStatus = document.getElementById("auth-status");
  const authTitle = document.getElementById("auth-title");

  let auth = { authenticated: false, username: null };

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function setSignupLocked(locked) {
    if (locked) {
      signupLockedBanner.classList.remove("hidden");
    } else {
      signupLockedBanner.classList.add("hidden");
    }

    signupForm
      .querySelectorAll("input, select, button")
      .forEach((el) => (el.disabled = locked));
  }

  function setAuthStatus(text, type) {
    if (!text) {
      authStatus.classList.add("hidden");
      authStatus.textContent = "";
      authStatus.className = "message hidden";
      return;
    }

    authStatus.textContent = text;
    authStatus.className = type;
    authStatus.classList.remove("hidden");
  }

  function updateAuthUI() {
    setSignupLocked(!auth.authenticated);

    if (auth.authenticated) {
      authTitle.textContent = "Teacher Account";
      authSubmit.classList.add("hidden");
      authLogout.classList.remove("hidden");
      authUsername.disabled = true;
      authPassword.disabled = true;
      setAuthStatus(`Logged in as ${auth.username}`, "success");
    } else {
      authTitle.textContent = "Teacher Login";
      authSubmit.classList.remove("hidden");
      authLogout.classList.add("hidden");
      authUsername.disabled = false;
      authPassword.disabled = false;
      setAuthStatus("", "");
    }
  }

  function openAuthModal() {
    authModal.classList.remove("hidden");
    updateAuthUI();
    if (!auth.authenticated) {
      authPassword.value = "";
      authUsername.focus();
    }
  }

  function closeAuthModal() {
    authModal.classList.add("hidden");
  }

  async function refreshAuth() {
    try {
      const response = await fetch("/auth/me", { credentials: "same-origin" });
      const data = await response.json();
      auth = {
        authenticated: Boolean(data.authenticated),
        username: data.username || null,
      };
    } catch (error) {
      auth = { authenticated: false, username: null };
      console.error("Error fetching auth state:", error);
    }
    updateAuthUI();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML. Only teachers can unregister.
        const canManage = auth.authenticated;
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        canManage
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      if (auth.authenticated) {
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          credentials: "same-origin",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";

        if (response.status === 401) {
          openAuthModal();
        }
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!auth.authenticated) {
      showMessage("Teacher login required to register students.", "error");
      openAuthModal();
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          credentials: "same-origin",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";

        if (response.status === 401) {
          openAuthModal();
        }
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  userMenuButton.addEventListener("click", openAuthModal);
  authClose.addEventListener("click", closeAuthModal);
  authModal.addEventListener("click", (event) => {
    if (event.target === authModal) {
      closeAuthModal();
    }
  });

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (auth.authenticated) {
      return;
    }

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: authUsername.value,
          password: authPassword.value,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setAuthStatus(result.detail || "Login failed", "error");
        return;
      }

      auth = {
        authenticated: true,
        username: result.username,
      };
      updateAuthUI();
      closeAuthModal();
      fetchActivities();
      showMessage(`Logged in as ${auth.username}`, "success");
    } catch (error) {
      setAuthStatus("Login failed. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  authLogout.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }

    auth = { authenticated: false, username: null };
    updateAuthUI();
    closeAuthModal();
    fetchActivities();
    showMessage("Logged out", "info");
  });

  refreshAuth().then(fetchActivities);
});
