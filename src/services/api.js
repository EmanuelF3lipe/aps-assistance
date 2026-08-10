const API_BASE = '/api';

export const api = {
  // Folders
  async getFolders() {
    const res = await fetch(`${API_BASE}/folders`);
    return res.json();
  },

  async createFolder(name) {
    const res = await fetch(`${API_BASE}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    return res.json();
  },

  async renameFolder(oldName, newName) {
    const res = await fetch(`${API_BASE}/folders/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName })
    });
    return res.json();
  },

  async deleteFolder(name) {
    const res = await fetch(`${API_BASE}/folders/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // Files
  async getFiles(folder) {
    const res = await fetch(`${API_BASE}/files/${encodeURIComponent(folder)}`);
    return res.json();
  },

  async getFile(folder, filename) {
    const res = await fetch(`${API_BASE}/file/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`);
    return res.json();
  },

  async createFile(folder, filename, content) {
    const res = await fetch(`${API_BASE}/file/${encodeURIComponent(folder)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content })
    });
    return res.json();
  },

  async updateFile(folder, filename, content) {
    const res = await fetch(`${API_BASE}/file/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    return res.json();
  },

  async deleteFile(folder, filename) {
    const res = await fetch(`${API_BASE}/file/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  async renameFile(folder, filename, newFilename) {
    const res = await fetch(`${API_BASE}/file/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}/rename`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newFilename })
    });
    return res.json();
  },

  async updateTags(folder, filename, tags) {
    const res = await fetch(`${API_BASE}/file/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}/tags`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags })
    });
    return res.json();
  },

  async moveFile(folder, filename, targetFolder) {
    const res = await fetch(`${API_BASE}/file/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}/move`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetFolder })
    });
    return res.json();
  },

  // Attachments
  async uploadAttachment(folder, filename, fileData, originalName) {
    const res = await fetch(`${API_BASE}/attachments/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, filename, fileData, originalName })
    });
    return res.json();
  },

  async getAttachments(folder, filename) {
    const res = await fetch(`${API_BASE}/attachments/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`);
    return res.json();
  },

  async deleteAttachment(folder, fileName) {
    const res = await fetch(`${API_BASE}/attachments/${encodeURIComponent(folder)}/${encodeURIComponent(fileName)}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // Search
  async search(query) {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
    return res.json();
  },

  async advancedSearch(filters) {
    const params = new URLSearchParams();
    if (filters.query) params.append('q', filters.query);
    if (filters.folder) params.append('folder', filters.folder);
    if (filters.tags) params.append('tags', filters.tags);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    const res = await fetch(`${API_BASE}/search/advanced?${params.toString()}`);
    return res.json();
  },

  // Stats
  async getStats() {
    const res = await fetch(`${API_BASE}/stats`);
    return res.json();
  },

  // Trash
  async getTrash() {
    const res = await fetch(`${API_BASE}/trash`);
    return res.json();
  },

  async restoreFromTrash(filename) {
    const res = await fetch(`${API_BASE}/trash/restore/${encodeURIComponent(filename)}`, {
      method: 'PUT'
    });
    return res.json();
  },

  async deleteFromTrash(filename) {
    const res = await fetch(`${API_BASE}/trash/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  async emptyTrash() {
    const res = await fetch(`${API_BASE}/trash`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // Tags
  async getTags() {
    const res = await fetch(`${API_BASE}/tags`);
    return res.json();
  },

  // Favorites
  async getFavorites() {
    const res = await fetch(`${API_BASE}/favorites`);
    return res.json();
  },

  async addFavorite(filename, folder) {
    const res = await fetch(`${API_BASE}/favorites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, folder })
    });
    return res.json();
  },

  async removeFavorite(filename, folder) {
    const res = await fetch(`${API_BASE}/favorites/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // Reports
  async getReports() {
    const res = await fetch(`${API_BASE}/reports`);
    return res.json();
  },

  async createReport(title, category, content) {
    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, content })
    });
    return res.json();
  },

  async updateReport(id, title, category, content) {
    const res = await fetch(`${API_BASE}/reports/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, content })
    });
    return res.json();
  },

  async deleteReport(id) {
    const res = await fetch(`${API_BASE}/reports/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // Folder Colors
  async getFolderColors() {
    const res = await fetch(`${API_BASE}/folder-colors`);
    return res.json();
  },

  async setFolderColor(folder, color) {
    const res = await fetch(`${API_BASE}/folder-colors/${encodeURIComponent(folder)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color })
    });
    return res.json();
  },

  async removeFolderColor(folder) {
    const res = await fetch(`${API_BASE}/folder-colors/${encodeURIComponent(folder)}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // Bot Config
  async getBotConfig() {
    const res = await fetch(`${API_BASE}/bot-config`);
    return res.json();
  },

  async setBotConfig(token) {
    const res = await fetch(`${API_BASE}/bot-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    return res.json();
  },

  async stopBot() {
    const res = await fetch(`${API_BASE}/bot-stop`, { method: 'POST' });
    return res.json();
  },

  // Diary
  async getDiary(filters = {}) {
    const params = new URLSearchParams();
    if (filters.date) params.append('date', filters.date);
    if (filters.search) params.append('search', filters.search);
    const res = await fetch(`${API_BASE}/diary?${params.toString()}`);
    return res.json();
  },

  async createDiaryEntry(entry) {
    const res = await fetch(`${API_BASE}/diary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    return res.json();
  },

  async updateDiaryEntry(id, data) {
    const res = await fetch(`${API_BASE}/diary/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async deleteDiaryEntry(id) {
    const res = await fetch(`${API_BASE}/diary/${id}`, { method: 'DELETE' });
    return res.json();
  }
};
