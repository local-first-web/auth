
import Chart, { ChartItem } from 'chart.js/auto'


(async function() {
  new Chart(
    document.getElementById('average-diffs')! as ChartItem,
    {
      type: 'bar',
      data: {
        // @ts-ignore
        labels: data.map(row => row.userCount),
        datasets: [
          {
            label: 'Avg Member Diff',
            // @ts-ignore
            data: data.map(row => row.memberDiffMeta.avg),
          },
          {
            label: 'Number Of Members With Member Diff',
            // @ts-ignore
            data: data.map(row => row.memberDiffMeta.count)
          },
          {
            label: 'Avg Device Diff',
            // @ts-ignore
            data: data.map(row => row.deviceDiffMeta.avg)
          },
          {
            label: 'Number Of Members With Device Diff',
            // @ts-ignore
            data: data.map(row => row.deviceDiffMeta.count)
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            display: true
          },
          title: {
            text: 'Avg Diffs By User Count',
            display: true
          }
        }
      }
    }
  );
})();
