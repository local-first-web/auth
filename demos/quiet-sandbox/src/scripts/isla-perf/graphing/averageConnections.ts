
import Chart, { ChartItem } from 'chart.js/auto'


(async function() {
  new Chart(
    document.getElementById('average-connections')! as ChartItem,
    {
      type: 'bar',
      data: {
        // @ts-ignore
        labels: data.map(row => row.userCount),
        datasets: [
          {
            label: 'Avg Number of Connected Peers Per User',
            // @ts-ignore
            data: data.map(row => row.avgConnectedPeers),
          }
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          },
          title: {
            text: 'Avg Number of Connected Peers Per User',
            display: true
          }
        }
      }
    }
  );
})();
