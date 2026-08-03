(function (global) {
  "use strict";

  const escapeHTML = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function authReady() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const check = () => {
        if (typeof auth !== "undefined" && auth?.apiFetch) return resolve(auth);
        if (attempts++ > 120) return reject(new Error("نشست کاربری آماده نیست"));
        setTimeout(check, 50);
      };
      check();
    });
  }

  async function readJSON(response) {
    if (!response) throw new Error("پاسخی از سرور دریافت نشد");
    const raw = await response.text();
    let data = {};
    if (raw) {
      try { data = JSON.parse(raw); }
      catch { data = { raw }; }
    }
    if (!response.ok || data?.error) {
      const message = data?.error?.message || data?.error || data?.message || data?.raw || `خطای سرور (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  class CrmApi {
    constructor() {
      this.workspaceKey = localStorage.getItem("fapco-crm-workspace") || "";
    }

    async request(path, options = {}) {
      const currentAuth = await authReady();
      const headers = {
        ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(this.workspaceKey ? { "X-CRM-Workspace": this.workspaceKey } : {}),
        ...(options.headers || {})
      };
      return readJSON(await currentAuth.apiFetch(path, { ...options, headers }));
    }

    async getBootstrap() {
      let data;
      try {
        data = await this.request("/api/crm/bootstrap");
      } catch (error) {
        if (!this.workspaceKey || ![401, 403].includes(Number(error?.status))) throw error;
        this.workspaceKey = "";
        localStorage.removeItem("fapco-crm-workspace");
        data = await this.request("/api/crm/bootstrap");
      }
      if (data.workspace?.id) {
        this.workspaceKey = data.workspace.id;
        localStorage.setItem("fapco-crm-workspace", this.workspaceKey);
      }
      return data;
    }

    async updateWorkspace(input) { return this.request("/api/crm/workspace", { method: "PUT", body: JSON.stringify(input) }); }
    async listTeam() { return (await this.request("/api/crm/team")).members || []; }
    async addTeamMember(input) { return (await this.request("/api/crm/team", { method: "POST", body: JSON.stringify(input) })).members || []; }
    async updateTeamMember(userID, input) { return (await this.request(`/api/crm/team/${encodeURIComponent(userID)}`, { method: "PUT", body: JSON.stringify(input) })).members || []; }
    async removeTeamMember(userID) { return (await this.request(`/api/crm/team/${encodeURIComponent(userID)}`, { method: "DELETE" })).members || []; }

    async getDashboard() { return this.request("/api/crm/dashboard"); }
    async getReports() { return this.request("/api/crm/reports"); }
    async search(query) { return this.request(`/api/crm/search?q=${encodeURIComponent(query || "")}`); }
    async askAssistant(prompt, context = {}) {
      const data = await this.request("/api/crm/assistant", { method: "POST", body: JSON.stringify({ prompt, context }) });
      return {
        html: `<div>${escapeHTML(data.text || "").replaceAll("\n", "<br>")}</div>`,
        links: data.links || []
      };
    }

    async listProducts(filters = {}) {
      const query = filters.type && filters.type !== "all" ? `?type=${encodeURIComponent(filters.type)}` : "";
      return (await this.request(`/api/crm/products${query}`)).products || [];
    }
    async createProduct(input) { return (await this.request("/api/crm/products", { method: "POST", body: JSON.stringify(input) })).product; }
    async updateProduct(id, input) { return (await this.request(`/api/crm/products/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) })).product; }
    async deleteProduct(id) { return this.request(`/api/crm/products/${encodeURIComponent(id)}`, { method: "DELETE" }); }

    async listCustomers(filters = {}) {
      const params = new URLSearchParams();
      if (filters.query) params.set("q", filters.query);
      if (filters.health) params.set("health", filters.health);
      if (filters.tier) params.set("tier", filters.tier);
      const suffix = params.toString() ? `?${params}` : "";
      return (await this.request(`/api/crm/customers${suffix}`)).customers || [];
    }
    async getCustomer(id) { return (await this.request(`/api/crm/customers/${encodeURIComponent(id)}`)).customer; }
    async createCustomer(input) { return (await this.request("/api/crm/customers", { method: "POST", body: JSON.stringify(input) })).customer; }
    async updateCustomer(id, input) { return (await this.request(`/api/crm/customers/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) })).customer; }
    async deleteCustomer(id) { return this.request(`/api/crm/customers/${encodeURIComponent(id)}`, { method: "DELETE" }); }
    async addCustomerNote(id, input) { return (await this.request(`/api/crm/customers/${encodeURIComponent(id)}/notes`, { method: "POST", body: JSON.stringify(input) })).customer; }
    async generateCustomerSummary(id) { return (await this.request(`/api/crm/customers/${encodeURIComponent(id)}/summary`, { method: "POST", body: "{}" })).customer; }
    async addContact(customerId, input) { return (await this.request(`/api/crm/customers/${encodeURIComponent(customerId)}/contacts`, { method: "POST", body: JSON.stringify(input) })).contact; }
    async updateContact(customerId, contactId, input) { return (await this.request(`/api/crm/customers/${encodeURIComponent(customerId)}/contacts/${encodeURIComponent(contactId)}`, { method: "PUT", body: JSON.stringify(input) })).contact; }
    async deleteContact(customerId, contactId) { return this.request(`/api/crm/customers/${encodeURIComponent(customerId)}/contacts/${encodeURIComponent(contactId)}`, { method: "DELETE" }); }
    async addAsset(customerId, input) { return (await this.request(`/api/crm/customers/${encodeURIComponent(customerId)}/assets`, { method: "POST", body: JSON.stringify(input) })).customer; }
    async deleteAsset(customerId, assetId) { return this.request(`/api/crm/customers/${encodeURIComponent(customerId)}/assets/${encodeURIComponent(assetId)}`, { method: "DELETE" }); }
    async addTicket(customerId, input) { return (await this.request(`/api/crm/customers/${encodeURIComponent(customerId)}/tickets`, { method: "POST", body: JSON.stringify(input) })).ticket; }
    async updateTicket(customerId, ticketId, input) { return (await this.request(`/api/crm/customers/${encodeURIComponent(customerId)}/tickets/${encodeURIComponent(ticketId)}`, { method: "PUT", body: JSON.stringify(input) })).ticket; }

    async listOpportunities(filters = {}) {
      const params = new URLSearchParams();
      if (filters.stage) params.set("stage", filters.stage);
      if (filters.type) params.set("type", filters.type);
      const suffix = params.toString() ? `?${params}` : "";
      return (await this.request(`/api/crm/opportunities${suffix}`)).opportunities || [];
    }
    async createOpportunity(input) { return (await this.request("/api/crm/opportunities", { method: "POST", body: JSON.stringify(input) })).opportunity; }
    async updateOpportunity(id, input) { return (await this.request(`/api/crm/opportunities/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) })).opportunity; }
    async updateOpportunityStage(id, stage) { return this.updateOpportunity(id, { stage }); }
    async deleteOpportunity(id) { return this.request(`/api/crm/opportunities/${encodeURIComponent(id)}`, { method: "DELETE" }); }

    async listTasks(includeDone = false) { return (await this.request(`/api/crm/tasks?includeDone=${includeDone ? "true" : "false"}`)).tasks || []; }
    async createTask(input) { return (await this.request("/api/crm/tasks", { method: "POST", body: JSON.stringify(input) })).task; }
    async updateTask(id, input) { return (await this.request(`/api/crm/tasks/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) })).task; }
    async deleteTask(id) { return this.request(`/api/crm/tasks/${encodeURIComponent(id)}`, { method: "DELETE" }); }
    async toggleTask(id) { return (await this.request(`/api/crm/tasks/${encodeURIComponent(id)}/toggle`, { method: "PUT", body: "{}" })).task; }

    async listConversations() { return (await this.request("/api/crm/conversations")).conversations || []; }
    async getConversation(id) { return (await this.request(`/api/crm/conversations/${encodeURIComponent(id)}`)).conversation; }
    async updateConversation(id, input) { return (await this.request(`/api/crm/conversations/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) })).conversation; }
    async createConversation(input) { return (await this.request("/api/crm/conversations", { method: "POST", body: JSON.stringify(input) })).conversation; }
    async analyzeConversation(id) { return (await this.request(`/api/crm/conversations/${encodeURIComponent(id)}/analyze`, { method: "POST", body: "{}" })).conversation; }
    async generateReply(id, tone = "formal") { return (await this.request(`/api/crm/conversations/${encodeURIComponent(id)}/reply-draft`, { method: "POST", body: JSON.stringify({ tone }) })).text || ""; }
    async saveReply(id, text) { return (await this.request(`/api/crm/conversations/${encodeURIComponent(id)}/replies`, { method: "POST", body: JSON.stringify({ text }) })).conversation; }
  }

  global.FapcoCrmApi = CrmApi;
  global.createCrmApi = () => new CrmApi();
})(window);
