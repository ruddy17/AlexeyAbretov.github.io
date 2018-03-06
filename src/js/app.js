const internalFetch = (url, options) => {
    const fetchOptions = { ...options } || {};
    fetchOptions.credentials = 'same-origin';
    fetchOptions.headers = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    };

    fetchOptions.method = fetchOptions.method || 'POST';

    if (fetchOptions.body && typeof (fetchOptions.body) !== 'string') {
        fetchOptions.body = JSON.stringify(fetchOptions.body);
    }

    return fetch(url, fetchOptions)
        .then((response) => {
            if (response.status >= 400) {
                return {};
            }
            return response.json();
        })
        .catch((err) => {
            console.log(err);
            return {};
        });
};

let itemsById = {};

internalFetch('http://95.163.251.187/api/v1/tag/hierarchy', {
    method: 'GET'
}).then((response) => {
    const prepareData = function processItems(data = [], tag) {
        return data.map(x => {
            const hierarchy = x.hierarchy ?
                processItems(
                    Array.isArray(x.hierarchy) ?
                        x.hierarchy :
                        [x.hierarchy],
                    tag ? `${tag}.${x.tag}` : x.tag) :
                null;

            itemsById[x.tag || 'tag0'] = hierarchy;

            return {
                tag: x.tag || 'tag0',
                fullTag: tag ? `${tag}.${x.tag}` : '',
                description: x.description || 'Месторождения',
                itemLevel: x.level,
                hierarchy
            }
        });
    };

    const data = prepareData(response || [], null);

    var dataSource = new kendo.data.HierarchicalDataSource({
        data: data,
        schema: {
            model: {
                children: "hierarchy",
                id: 'tag'
            }
        }
    });

    $("#treeview-left").kendoTreeView({
        dataSource,
        dataTextField: ["description"],
        change: function (e) {
            renderTagChart();
        }
    });

    renderDashboardCharts();
});

$("#vertical").kendoSplitter({
    panes: [
        { collapsible: false, size: "20%" },
        { collapsible: false },
    ]
});

$("#chartType").kendoDropDownList();
$("#date").kendoDropDownList();
$("#period").kendoDropDownList();
$("#refreshRate").kendoDropDownList();

$("#refresh").kendoButton({
    click: function (e) {
        renderDashboardCharts();
    }
});

$("#alerts").kendoButton({
    click: function (e) {
        renderAlerts();
    }
});

// let alertsInterval = 0;
let refreshAlertsButton = null;

function prepareAlertsGrid() {
    // if (alertsInterval) {
    //     clearInterval(alertsInterval);
    // }

    var { tag } = getParams();

    var data = getTagAlerts(tag);

    return data.then((response) => {
        const sorted = response.sort((a, b) => b.time_begin - a.time_begin);
        const alerts = [];
        const allAlerts = [];

        sorted.forEach(w => {
            let bDate = w.time_begin;
            let eDate = w.time_end;

            if (!bDate.toString().length == 10) {
                bDate *= 1e3;
            }

            if (!eDate.toString().length == 10) {
                eDate *= 1e3;
            }

            const items = alerts.filter(x => x.rule_id === w.rule_id);

            if (!items.length) {
                alerts.push({
                    rule_id: w.rule_id,
                    rule: w.rule,
                    bDate: new Date(bDate).toLocaleFormat('%d.%m.%Y %H:%M:%S'),
                    eDate: new Date(eDate).toLocaleFormat('%d.%m.%Y %H:%M:%S'),
                    count: w.count,
                    isActive: w.alert,
                    last_value: w.last_value
                });
            }/* else {
                items[0].bDate = new Date(bDate).toLocaleFormat('%d.%m.%Y %H:%M:%S');
                items[0].eDate = new Date(eDate).toLocaleFormat('%d.%m.%Y %H:%M:%S');
                items[0].count = w.count;
                items[0].isActive = w.alert;
            }*/

            allAlerts.push({
                rule_id: w.rule_id,
                rule: w.rule,
                bDate: new Date(bDate).toLocaleFormat('%d.%m.%Y %H:%M:%S'),
                eDate: new Date(eDate).toLocaleFormat('%d.%m.%Y %H:%M:%S'),
                count: w.count,
                last_value: w.last_value,
                isActive: w.alert
            });
        });

        const ds = new kendo.data.DataSource({
            data: alerts,
            schema: {
                model: {
                    fields: {
                        rule_id: { type: "number" },
                        rule: { type: "string" },
                        bDate: { type: "string" },
                        eDate: { type: "string" },
                        count: { type: "number" },
                        last_value: { type: "string" },
                        isActive: { type: "boolean" }
                    }
                },
                total: function (response) {
                    return response.length;
                },
            },
            pageSize: 20,
            autoSync: true
        });

        const alertGrid = $("#alertsGrid").kendoGrid({
            height: '580px',
            scrollable: true,
            sortable: true,
            filterable: true,
            pageable: {
                input: true,
                numeric: false
            },
            columns: [
                { field: "rule_id", title: "Номер" },
                { field: "rule", title: "Правило" },
                { field: "bDate", title: "Дата начала" },
                { field: "eDate", title: "Дата окончания" },
                { field: "count", title: "Число отчетов" },
                { field: "last_value", title: "Последнее значение" }
            ],
            dataBound: function (e) {
                var rows = e.sender.tbody.children();

                for (var j = 0; j < rows.length; j++) {
                    var row = $(rows[j]);
                    var dataItem = e.sender.dataItem(row);

                    if (dataItem.get("isActive") == true) {
                        row.addClass("red");
                    } else {
                        row.addClass("green");
                    }
                }
            }
        });

        $("#alertsGrid").data("kendoGrid").setDataSource(ds);

        const allds = new kendo.data.DataSource({
            data: allAlerts,
            schema: {
                model: {
                    fields: {
                        rule_id: { type: "number" },
                        rule: { type: "string" },
                        bDate: { type: "string" },
                        eDate: { type: "string" },
                        count: { type: "number" },
                        last_value: { type: "string" },
                        isActive: { type: "boolean" }
                    }
                },
                total: function (response) {
                    return response.length;
                },
            },
            pageSize: 20,
            autoSync: true
        });

        let allGrid = $("#allAlertsGrid").kendoGrid({
            height: '580px',
            scrollable: true,
            sortable: true,
            filterable: true,
            pageable: {
                input: true,
                numeric: false
            },
            columns: [
                { field: "rule_id", title: "Номер" },
                { field: "rule", title: "Правило" },
                { field: "bDate", title: "Дата начала" },
                { field: "eDate", title: "Дата окончания" },
                { field: "count", title: "Число отчетов" },
                { field: "last_value", title: "Последнее значение" }
            ],
            dataBound: function (e) {
                var rows = e.sender.tbody.children();

                for (var j = 0; j < rows.length; j++) {
                    var row = $(rows[j]);
                    var dataItem = e.sender.dataItem(row);

                    if (dataItem.get("isActive") == true) {
                        row.addClass("red");
                    } else {
                        row.addClass("green");
                    }
                }
            }
        });

        $("#allAlertsGrid").data("kendoGrid").setDataSource(allds);

        if ($("#allAlerts").is(":checked")) {
            $("#allAlertsGrid").show();
            $("#alertsGrid").hide();
        } else {
            setTimeout(() => {
                $("#allAlertsGrid").hide()
            }, 500);
            $("#alertsGrid").show();
        }

        if (!refreshAlertsButton) {
            refreshAlertsButton = $("#refreshAlerts").kendoButton({
                click: function (e) {
                    prepareAlertsGrid();
                }
            });
        }

        // alertsInterval = setInterval(prepareAlertsGrid, 5000);
    });
}

$("#allAlerts").on("click", () => {
    prepareAlertsGrid();
})
function renderAlerts() {
    prepareAlertsGrid().then(_ => {
        $("#alertsWindow").kendoWindow({
            title: "Журнал событий",
            width: '80%',
            height: '650px',
            visible: false,
            actions: [
                "Minimize",
                "Maximize",
                "Close"
            ]/*,
            close: function () {
                clearInterval(alertsInterval);
            }*/
        }).data("kendoWindow").center().open();
    });
}

const charts = {
    chart1: [
        'WQ2_0151_12_106_09.Well191.ESP.Status_Local',
        'WQ2_0151_12_106_09.Well191.ESP.Underload_SP',
        'WQ2_0151_12_106_09.Well191.ESP.Status_LastShutdownReason',
        'WQ2_0151_12_106_09.Well191.ESP.HIDCPassiveCurrentLeakage_Enable'
    ],

    chart2: [
        'WQ2_0151_12_106_09.Well191.Well.IPM_WaterRate_Std',
        'WQ2_0151_12_106_09.Well191.Well.PIC004_CV',
        'WQ2_0151_12_106_09.Well191.Well.WellTest_EndTime'
    ],

    chart3: [
        'WQ2_0151_12_106_09.Well191.Well.IPM_OilRate_Std'
    ]
}
let renderDashboardChartsInterval = 0;
function renderDashboardCharts() {

    if (renderDashboardChartsInterval) {
        clearInterval(renderDashboardChartsInterval);
    }

    let { type, period, from, to, refreshRate } = getParams();

    renderDashboardChart('chart1', type, period, from, to)
        .then(_ => renderDashboardChart('chart2', type, period, from, to)
            .then(_ => renderDashboardChart('chart3', type, period, from, to)
                .then(_ => {
                    renderDashboardChartsInterval = setInterval(
                        renderDashboardCharts, refreshRate);
                })));
}

function renderDashboardChart(name, type, period, from, to) {
    return Promise
        .all(charts[name].map(x => getTagData(x, period, from, to)))
        .then(responses => {
            let series = [];
            let categories = [];

            responses.forEach(x => {
                const data = ((x || {}).data || []);

                data.forEach(d => {
                    const t = new Date(d.time).toLocaleFormat('%d.%m.%Y %H:%M:%S');
                    if (categories.indexOf(t) == -1) {
                        categories.push(t);
                    }
                });
            });

            categories = categories
                .sort((a, b) => Date.parse(a) - Date.parse(b));

            responses.forEach((x, index) => {
                const data = ((x || {}).data || []).sort((a, b) => a.time - b.time);

                series.push({
                    name: window[name][index],
                    data: []
                });

                categories.forEach(c => {
                    const r = data.filter(d => new Date(d.time)
                        .toLocaleFormat('%d.%m.%Y %H:%M:%S') === c);
                    if (r.length) {
                        series[series.length - 1].data.push(r[0].value);
                    } else {
                        series[series.length - 1].data.push(null);
                    }
                });
            });

            createChat(
                `#${name}`,
                type.toLowerCase(),
                series,
                categories);
        });
}

let tagsDataIntervalTicket = 0;
function renderTagChart() {
    let { tag, level, id } = getParams();

    if (level === 4) {
        let to = parseInt((Date.now() / 1000).toFixed(0)) * 1000;
        let from = new Date();
        let offset = 24;
        from = parseInt((from.setHours(from.getHours() - offset) / 1000).toFixed(0)) * 1000;

        let data = getTagData(tag, '1m', from, to);

        data.then((response) => {
            const chartData = prepareChartData((response || {}).data || []);

            createChat(
                "#chart",
                'line',
                [{
                    name: tag,
                    data: chartData.data
                }],
                chartData.categories);

            $("#chartWindow").kendoWindow({
                width: '100%',
                title: "График",
                visible: false,
                actions: [
                    "Minimize",
                    "Maximize",
                    "Close"
                ],
            }).data("kendoWindow").center().open();
        });
    } else if (level === 2 || level === 3) {
        clearInterval(tagsDataIntervalTicket);

        let tags = level === 3 ?
            itemsById[id].map(x => ({
                title: x.description,
                id: x.fullTag,
                state: ''
            })) :
            [];

        if (level === 2) {
            itemsById[id].forEach(x =>
                tags = tags.concat(x.hierarchy.map(z => ({
                    title: z.description,
                    id: x.fullTag,
                    state: ''
                })))
            )
        }

        var dataSource = new kendo.data.DataSource({
            schema: {
                model: {
                    fields: {
                        title: { type: "string" },
                        state: { type: "string" }
                    }
                },
                total: function (response) {
                    return response.length;
                },
            },
            pageSize: 20,
            data: tags,
            autoSync: true
        });

        $("#tagsGrid").kendoGrid({
            scrollable: true,
            sortable: true,
            filterable: true,
            pageable: {
                input: true,
                numeric: false
            },
            columns: [
                { field: "title", title: "Название" },
                { field: "state", title: "Значение" },
            ],
            page: () => {
                clearInterval(tagsDataIntervalTicket);
                setTimeout(() => {
                    getLastTagsState().then(_ =>
                        tagsDataIntervalTicket = setInterval(getLastTagsState, 5000))
                }, 0);
            }
        });

        var grid = $("#tagsGrid").data("kendoGrid");
        grid.setDataSource(dataSource);

        getLastTagsState();

        $("#tagsWindow").kendoWindow({
            title: "Показатели",
            visible: false,
            width: '50%',
            height: '70%',
            actions: [
                "Minimize",
                "Maximize",
                "Close"
            ],
            close: () => {
                clearInterval(tagsDataIntervalTicket);
            },
            open: () => {
                clearInterval(tagsDataIntervalTicket);
                tagsDataIntervalTicket = setInterval(getLastTagsState, 5000);
            }
        }).data("kendoWindow").center().open();
    }
}

function getLastTagsState() {
    const grid = $("#tagsGrid").data("kendoGrid");
    const view = grid.dataSource.view();

    let to = parseInt((Date.now() / 1000).toFixed(0)) * 1000;
    let from = new Date();
    let offset = 24;
    from = parseInt((from.setHours(from.getHours() - offset) / 1000).toFixed(0)) * 1000;

    let data = getTagData(view[0].id, '8h', from, to);
    return Promise
        .all(view.map(x => getTagData(x.id, '8h', from, to)))
        .then(responses => {
            responses.forEach((res, index) => {
                const arr = ((res || {}).data || []);
                const val = (arr[arr.length - 1] || {}).value
                if (view[index].set) {
                    view[index].set('state', val);
                } else {
                    view[index].state = val;
                }
            });
        });
}

function prepareChartData(data = []) {
    const result = {
        data: [],
        categories: []
    };

    data = data.sort((a, b) => a.time - b.time);

    data.forEach((x, index) => {
        const v = x.value;
        const t = x.time;

        const date = new Date(t).toLocaleFormat('%d.%m.%Y %H:%M:%S');

        if (result.categories.indexOf(date) == -1) {
            result.categories.push(date);
            result.data.push(v);
        }
    });

    return result;
}

function getTagData(tag, period, from, to) {
    return internalFetch(`http://95.163.251.187/api/v1/data?tag=${tag}&period=${period}&from_ts=${from}&to_ts=${to}`, {
        method: 'GET'
    })
}

function getTagAlerts(tag) {
    return internalFetch(`http://95.163.251.187/api/v1/alerts?tag=${tag}`, {
        method: 'GET'
    })
}

function getParams() {
    const tv = $('#treeview-left')
        .data('kendoTreeView');
    const selected = tv
        .select();

    const data = tv.dataItem(selected);

    const tag = (data || {}).fullTag;
    const id = (data || {}).id;
    const level = (data || {}).itemLevel;

    const period = $("#period").data("kendoDropDownList").value();
    const type = $("#chartType").data("kendoDropDownList").value();
    const date = $("#date").data("kendoDropDownList").value();
    const refreshRateDirtyValue = $("#refreshRate").data("kendoDropDownList").value();

    let refreshRate = 15;

    switch (refreshRateDirtyValue) {
        case '5s':
            refreshRate = 5000;
            break;
        case '15s':
            refreshRate = 15000;
            break;
        case '30s':
            refreshRate = 30000;
            break;
        case '1m':
            refreshRate = 60000;
            break;
        case '15m':
            refreshRate = 15 * 60000;
            break;
        default:
            refreshRate = 15000;
            break;
    }

    let to = parseInt((Date.now() / 1000).toFixed(0)) * 1000;
    let from = new Date();

    let offset = 1;

    switch (date) {
        case '8h':
            offset = 8;
            break;
        case '12h':
            offset = 12;
            break;
        case '24h':
            offset = 24;
            break;
        case '3d':
            offset = 24 * 3;
            break;
        case '1w':
            offset = 24 * 7;
            break;
        case '1h':
        default:
            offset = 1;
            break;
    }
    from = parseInt((from.setHours(from.getHours() - offset) / 1000).toFixed(0)) * 1000;

    return {
        tag,
        period,
        type,
        level,
        id,
        to,
        from,
        refreshRate
    }
}

function createChat(id, type = 'line', series = [{ name: 'main', data: [] }], categories = []) {
    $(id).kendoChart({
        title: {
            text: "Chart"
        },
        legend: {
            position: "bottom"
        },
        chartArea: {
            background: ""
        },
        seriesDefaults: {
            type: type === 'bar' ? 'column' : type,
            style: "smooth",
            markers: {
                visible: true,
                size: categories.length >= 100 ?
                    2 :
                    5
            }
        },
        series,
        valueAxis: {
            labels: {
                format: "{0}"
            },
            line: {
                visible: false
            },
            axisCrossingValue: [-1e6, -1e6]
        },
        categoryAxis: {
            categories,
            majorGridLines: {
                visible: false
            },
            labels: {
                rotation: "auto",
                step: categories.length >= 100 ?
                    parseInt((categories.length / 20).toFixed(0)) :
                    null
            }
        },
        tooltip: {
            visible: true,
            format: "{0}%",
            template: "#= series.name #: #= value #"
        }
    });
}

if (!Date.prototype.toLocaleFormat) {
    Date.prototype.toLocaleFormat = function (format) {
        var f = {
            Y: this.getFullYear(),
            y: this.getFullYear() - (this.getFullYear() >= 2e3 ? 2e3 : 1900),
            m: this.getMonth() + 1,
            d: this.getDate(),
            H: this.getHours(),
            M: this.getMinutes(),
            S: this.getSeconds()
        }, k;
        for (k in f)
            format = format.replace('%' + k, f[k] < 10 ? "0" + f[k] : f[k]);
        return format;
    }
}

if (!String.prototype.endsWith) {
    Object.defineProperty(String.prototype, 'endsWith', {
        value: function (searchString, position) {
            var subjectString = this.toString();
            if (position === undefined || position > subjectString.length) {
                position = subjectString.length;
            }
            position -= searchString.length;
            var lastIndex = subjectString.indexOf(searchString, position);
            return lastIndex !== -1 && lastIndex === position;
        }
    });
}