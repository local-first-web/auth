
import Chart, { ChartItem } from 'chart.js/auto'


(async function() {
  new Chart(
    document.getElementById('average-load-times')! as ChartItem,
    {
      type: 'bar',
      data: {
        // @ts-ignore
        labels: data.map(row => row.userCount),
        datasets: [
          {
            label: 'Avg Chain Load Time Per User (ms)',
            // @ts-ignore
            data: data.map(row => row.avgChainLoadTimeMs),
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
            text: 'Avg Chain Load Times (ms)',
            display: true
          }
        }
      }
    }
  );
})();
