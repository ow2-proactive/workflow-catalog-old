var nsCtrl = angular.module('ns-rest', ['ngResource', 'spring-data-rest', 'angular-toArrayFilter', 'oitozero.ngSweetAlert']);

function getSessionId() {
    return localStorage['pa.session'];
}

// ---------- Utilities ----------

nsCtrl.filter('getByKey', function () {
    return function (propertyName, collection) {
        var len = collection.length;
        var value = '';
        for (var i = 0; i < len; i++) {
            if (collection[i].key == propertyName) {
                value = collection[i].value;
            }
        }
        return value;
    }
});

// TODO: should really use a library such as moment.js to format date
function formatDate(input, displaySeconds) {
    var date = new Date(input);
    minutes = date.getMinutes();
    if (minutes < 10) {
        minutes = '0' + minutes;
    }

    seconds = date.getSeconds();
    if (seconds < 10) {
        seconds = '0' + seconds;
    }

    var result = date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate()
        + " " + date.getHours() + ":" + minutes;

    if (displaySeconds) {
        result += ":" + seconds
    }

    return result;
}

nsCtrl.filter('displayDate', function () {
    return function (input) {
        return formatDate(input, true)
    }
});

nsCtrl.filter('displayDateWithoutSeconds', function () {
    return function (input) {
        return formatDate(input, false)
    }
});


// ---------- Services ----------

nsCtrl.factory('LoadingPropertiesService', function ($http) {
    $http.get('resources/nsportal.properties')
        .success(function (response) {
        	console.log(response)
        	workflowCatalogPortalQueryPeriod = response.workflowCatalogPortalQueryPeriod;
        	catalogServiceUrl = JSON.parse(angular.toJson(response.catalogServiceUrl, false));
            schedulerRestUrl = JSON.parse(angular.toJson(response.schedulerRestUrl, true));

            localStorage['workflowCatalogPortalQueryPeriod'] = workflowCatalogPortalQueryPeriod;
            localStorage['catalogServiceUrl'] = catalogServiceUrl;
            localStorage['schedulerRestUrl'] = schedulerRestUrl;

            console.log('LoadingPropertiesService has loaded workflowCatalogPortalQueryPeriod=', workflowCatalogPortalQueryPeriod);
            console.log('LoadingPropertiesService has loaded catalogServiceUrl=', catalogServiceUrl);
            console.log('LoadingPropertiesService has loaded schedulerRestUrl=', schedulerRestUrl);
        })
        .error(function (response) {
            console.error('Error loading workflow catalog portal configuration:', response);
        });

    return {
        doNothing: function () {
            return null;
        }
    };
});

nsCtrl.factory('WorkflowCatalogService', function ($http, $interval, $rootScope, $state, LoadingPropertiesService) {
    var buckets = [];
    var queryWorkflowCatalogServiceTimer;

    function doLogin(userName, userPass) {
        var authData = $.param({'username': userName, 'password': userPass});
        var authConfig = {
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            transformResponse: []
        };
        // because of that wrong response type in that sched resource !!!
        return $http.post(localStorage['schedulerRestUrl'] + 'login', authData, authConfig)
            .success(function (response) {
                if (response.match(/^[A-Za-z0-9]+$/)) {
                    localStorage['pa.session'] = response;
                    console.log('WorkflowCatalogService.doLogin authentication has succeeded:', response);
                }
                else {
                    console.log('WorkflowCatalogService.doLogin authentication has failed:', response);
                }
            })
            .error(function (response) {
                console.error('WorkflowCatalogService.doLogin authentication error:', status, response);
            });
    }

    function queryWorkflowCatalogService() {
        if (getSessionId() == undefined) {
            if (queryWorkflowCatalogServiceTimer != undefined) {
                console.log("Stopping regular query to catalog service");
                $rootScope.$interval.cancel(queryWorkflowCatalogServiceTimer);
                queryWorkflowCatalogServiceTimer = undefined;
            }

            $state.go('login');
            return;
        }

        $http.get(localStorage['catalogServiceUrl'] + 'buckets/')
            .success(function (response) {
                buckets = response._embedded.bucketMetadataList;
                $rootScope.$broadcast('event:WorkflowCatalogService');
            })
            .error(function (response) {
                console.error("Error while querying catalog service:", response);
            });
    }

    function startRegularWorkflowCatalogServiceQuery() {
        queryWorkflowCatalogServiceTimer =
            $rootScope.$interval(queryWorkflowCatalogService, localStorage['workflowCatalogPortalQueryPeriod']);
    }

    return {
        doLogin: function (userName, userPass) {
            return doLogin(userName, userPass);
        },
        getBuckets: function () {
            return buckets;
        },
        isConnected: function () {
            return getSessionId() != undefined;
        },
        startRegularWorkflowCatalogServiceQuery: function () {
            return startRegularWorkflowCatalogServiceQuery();
        }
    };
});


// ---------- Controllers ----------

nsCtrl.controller('WorkflowCatalogController', function ($scope, $rootScope, $http, SpringDataRestAdapter, WorkflowCatalogService) {

    $rootScope.$on('event:WorkflowCatalogService', function () {
        $scope.buckets = WorkflowCatalogService.getBuckets();
    });
});

nsCtrl.controller('loginController', function ($scope, $state, WorkflowCatalogService) {

    $scope.login = function () {
        var username = $scope.username;
        var password = $scope.password;

        localStorage['pa.login'] = username;
        $scope.main.userName = localStorage['pa.login'];

        WorkflowCatalogService.doLogin(username, password)
            .success(function (response) {
                var sessionid = getSessionId();

                if (sessionid != undefined) {
                    console.log('Authentication succeeded');

                    // Redirect to the main page
                    $state.go('index.main');

                    // Start workflow catalog refreshing services
                    WorkflowCatalogService.startRegularWorkflowCatalogServiceQuery();

                }
            })
            .error(function (response) {
                console.log('Authentication failed:', response);
            });
    };
});

nsCtrl.controller('logoutController', function ($rootScope, $scope, $state) {
    $scope.logout = function () {
        localStorage.removeItem('pa.session');

        // Stop all workflow catalog refreshing services
        $rootScope.$broadcast('event:StopRefreshing');

        $state.go('login');
    };
});
