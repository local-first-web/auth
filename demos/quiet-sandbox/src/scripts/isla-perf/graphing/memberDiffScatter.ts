// import Chart, { ChartData, ChartItem, Point } from 'chart.js/auto'

// @ts-ignore
var memberDiffChart: Chart | undefined

function getUserIndex(username: string): number {
  if (username === 'founding-perf-user') {
    return 0
  }

  return Number(username.split('-')[2]) + 1
}

async function drawMemberDiffScatter() {
  if (memberDiffChart != null) {
    memberDiffChart.destroy()
  }
  
  // @ts-ignore
  const userCount = selectedUserCount != null ? selectedUserCount : data[0].userCount;
  // @ts-ignore
  const dataRow = data.find(row => {
    return row.userCount == userCount
  });
  const DATA =  {
    // @ts-ignore
    labels: dataRow.memberDiffs.map(diff => diff.username),
    datasets: [{
      // @ts-ignore
      data: dataRow.memberDiffs.map(diff => ({
          x: getUserIndex(diff.username),
          y: diff.diff
        })
      )
    }]
  };

  // @ts-ignore
  memberDiffChart = new Chart(
    document.getElementById('member-diff-scatter')!,
    {
      type: 'scatter',
      data: DATA,
      options: {
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
          }
        },
        indexAxis: 'x',
        plugins: {
          title: {
            text: `Member Diffs (${userCount} Users)`,
            display: true
          },
          legend: {
            display: false
          }
        },
        responsive: true
      },
    }
  );
};