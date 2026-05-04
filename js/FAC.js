$(document).ready(function() {
    // Fazendo requisição AJAX para carregar dados JSON
    $.getJSON('/json/FAC.json', function(data) {
        // Filtra os dados por tipo de gráfico
        const pieChartsData = data.charts.filter(chart => chart.type === 'pie');
        const barChartsData = data.charts.filter(chart => chart.type === 'bar');

        // Função para criar gráficos
        function createCharts(containerId, chartData) {
            const container = document.getElementById(containerId);
            chartData.forEach((chart, index) => {
                const chartId = `${chart.type}Chart${index + 1}`;
                const chartCanvas = document.createElement('canvas');
                chartCanvas.id = chartId;
                chartCanvas.classList.add('chart-canvas');
                container.appendChild(chartCanvas);
        
                const ctx = chartCanvas.getContext('2d');
                new Chart(ctx, {
                    type: chart.type,
                    data: {
                        labels: chart.labels,
                        datasets: [{
                            label: chart.datasetLabel,
                            data: chart.datasetData,
                            backgroundColor: chart.type === 'pie' ? getDefaultPieColors() : getDefaultBarColors(),
                            borderColor: chart.type === 'pie' ? getDefaultPieBorderColors() : getDefaultBarBorderColors(),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            title: {
                                display: true,
                                text: `Gráfico ${chart.type === 'pie' ? 'de Pizza' : 'de Barras'} ${index + 1}`
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
            });
        }
        
        // Chamando a função para criar os gráficos de pizza e de barras
        createCharts('pieChartsRow', pieChartsData);
        createCharts('barChartsRow', barChartsData);
    });
});

function getDefaultPieColors() {
    return [
        "rgba(255, 99, 132, 0.3)",
        "rgba(54, 162, 235, 0.3)",
        "rgba(255, 206, 86, 0.3)",
        "rgba(75, 192, 192, 0.3)",
        "rgba(153, 102, 255, 0.3)",
        "rgba(255, 159, 64, 0.3)"
    ];
}

function getDefaultPieBorderColors() {
    return [
        "rgba(255, 99, 132, 1)",
        "rgba(54, 162, 235, 1)",
        "rgba(255, 206, 86, 1)",
        "rgba(75, 192, 192, 1)",
        "rgba(153, 102, 255, 1)",
        "rgba(255, 159, 64, 1)"
    ];
}

function getDefaultBarColors() {
    return [
        "rgba(255, 99, 132, 0.3)",
        "rgba(54, 162, 235, 0.3)",
        "rgba(255, 206, 86, 0.3)",
        "rgba(75, 192, 192, 0.3)",
        "rgba(153, 102, 255, 0.3)",
        "rgba(255, 159, 64, 0.3)"
    ];
}

function getDefaultBarBorderColors() {
    return [
        "rgba(255, 99, 132, 1)",
        "rgba(54, 162, 235, 1)",
        "rgba(255, 206, 86, 1)",
        "rgba(75, 192, 192, 1)",
        "rgba(153, 102, 255, 1)",
        "rgba(255, 159, 64, 1)"
    ];
}