import api from "./client";

export async function getAdminOverview() {
  const res = await api.get(`/admin/overview`);
  return res.data;
}

export async function getForecast(params = {}) {
  const res = await api.get(`/forecast`, { params });
  return res.data;
}

// Helper function to download CSV with authentication
const downloadCsvFile = async (endpoint, filename) => {
  try {
    const response = await api.get(endpoint, {
      responseType: 'blob',
      headers: {
        'Accept': 'text/csv'
      }
    });
    
    // Create blob link to download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('CSV download error:', error);
    alert('Failed to download CSV. Please try again.');
  }
};

export async function downloadStockCsv() {
  const filename = `stock_report_${new Date().toISOString().split('T')[0]}.csv`;
  await downloadCsvFile('/reports/stock.csv', filename);
}

export async function downloadUsageCsv(days = 90) {
  const filename = `usage_report_${days}days_${new Date().toISOString().split('T')[0]}.csv`;
  await downloadCsvFile(`/reports/usage.csv?days=${days}`, filename);
}

export async function downloadReplenishmentCsv() {
  const filename = `replenishment_${new Date().toISOString().split('T')[0]}.csv`;
  await downloadCsvFile('/reports/replenishment.csv', filename);
}