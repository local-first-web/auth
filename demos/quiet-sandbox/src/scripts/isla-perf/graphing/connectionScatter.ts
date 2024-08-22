// @ts-ignore
var connectedPeersChart: Chart | undefined

function getUserIndex(username: string): number {
  if (username === 'founding-perf-user') {
    return 0
  }

  return Number(username.split('-')[2]) + 1
}

async function drawConnectedPeersChart() {
  if (connectedPeersChart != null) {
    connectedPeersChart.destroy()
  }
  
  // @ts-ignore
  const userCount = selectedUserCount != null ? selectedUserCount : data[0].userCount;
  // @ts-ignore
  const dataRow = data.find(row => {
    return row.userCount == userCount
  });
  const DATA =  {
    // @ts-ignore
    labels: dataRow.connectedPeers.map(connectedPeers => connectedPeers.username),
    datasets: [{
      // @ts-ignore
      data: dataRow.connectedPeers.map(connectedPeers => ({
          x: getUserIndex(connectedPeers.username),
          y: connectedPeers.connectedPeers
        })
      )
    }]
  };

  // @ts-ignore
  connectedPeersChart = new Chart(
    document.getElementById('connected-peers-chart')!,
    {
      type: 'line',
      data: DATA,
      options: {
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
          }
        },
        plugins: {
          title: {
            text: `Connected Peers Per User (${userCount} Users)`,
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