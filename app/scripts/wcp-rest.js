var nsCtrl = angular.module('wcp-rest', ['ngResource', 'spring-data-rest', 'angular-toArrayFilter', 'oitozero.ngSweetAlert']);

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


// ---------- Services ----------

nsCtrl.factory('LoadingPropertiesService', function ($http) {
    $http.get('resources/wcportal.properties')
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
    var workflows = [];
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

        var url = localStorage['catalogServiceUrl'] + 'buckets/?kind=workflow';
        $http.get(url)
            .success(function (response) {
                buckets = response;
                $rootScope.$broadcast('event:WorkflowCatalogService');
            })
            .error(function (response) {
                console.error("Error while querying catalog service on URL " + url + ":", response);
            });
    }

    function startRegularWorkflowCatalogServiceQuery() {
        queryWorkflowCatalogServiceTimer =
            $rootScope.$interval(queryWorkflowCatalogService, localStorage['workflowCatalogPortalQueryPeriod']);
    }

    function queryWorkflows(bucketIndex, callback) {
    	var bucketId = buckets[bucketIndex].id;
    	var url = localStorage['catalogServiceUrl'] + 'buckets/' + bucketId + '/resources/?kind=workflow';
        $http.get(url)
            .success(function (response) {
            	callback(response);
            })
            .error(function (response) {
                console.error("Error while querying catalog service on URL " + url + ":", response);
            });
    }

    function queryWorkflowDescription(bucketIndex, name, callback) {
    	var bucketId = buckets[bucketIndex].id;
    	encodedName = unescape(encodeURIComponent(name));
    	
    	var url = localStorage['catalogServiceUrl'] + 'buckets/' + bucketId + '/resources/' + encodedName + "/";
        $http.get(url)
            .success(function (response) {
            	callback(response);
            })
            .error(function (response) {
                console.error("Error while querying catalog service on URL " + url + ":", response);
            });
    }

    return {
        doLogin: function (userName, userPass) {
            return doLogin(userName, userPass);
        },
        getBuckets: function () {
            return buckets;
        },
        getWorkflows: function (bucketIndex, callback) {
        	queryWorkflows(bucketIndex, callback);
        },
        getWorkflowDescription: function (bucketIndex, workflowName, callback) {
        	queryWorkflowDescription(bucketIndex, workflowName, callback);
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
	
	$scope.selectedBucketIndex = -1;
	$scope.selectedWorkflows = [];
	var initURL = 'http://proactive-dashboard/workflow-catalog/buckets/'
	$scope.url = initURL;
    
	$scope.selectWorkflow = function(name){
		var selectedWorkflow = {name: name, gis:[], variables: []}
		//TODO si la clé ctrl ou autre est pressée, on ajoute à la fin
		$scope.selectedWorkflows = [selectedWorkflow];
		
		WorkflowCatalogService.getWorkflowDescription($scope.selectedBucketIndex, name, function(workflow){
			selectedWorkflow.commit_time = workflow.commit_time;
			
			for (var metadataIndex = 0; metadataIndex < workflow.object_key_values.length; metadataIndex++){
				var label = workflow.object_key_values[metadataIndex].label;
				var key = workflow.object_key_values[metadataIndex].key;
				var value = workflow.object_key_values[metadataIndex].value;
				
				if (label == "job_information" && key == "project_name"){
					selectedWorkflow.project_name = value;
				}
				if (label == "generic_information"){
					selectedWorkflow.gis[selectedWorkflow.gis.length] = {key: key, value: value};
				}
				if (label == "variable"){
					selectedWorkflow.variables[selectedWorkflow.variables.length] = {key: key, value: value};
				}
			}
		});
    }
    
	$scope.selectBucket = function(index){
    	if (index != $scope.selectedBucketIndex && index != -1){
    		$scope.selectedBucketIndex = index;
    		$scope.url = initURL + $scope.buckets[index].name;
    		
    		WorkflowCatalogService.getWorkflows(index, function(workflows){
    			$scope.workflows = workflows;
    			if (workflows.length > 0){
    				$scope.selectWorkflow(workflows[0].name);
    			}
    		});
    	}
    }
	
	$scope.goToUrl = function(){
		var bucket = $scope.url.replace(initURL, '');
		var found = false;
		for (var bucketIndex = 0; bucketIndex < $scope.buckets.length; bucketIndex++){
			if ($scope.buckets[bucketIndex].name == bucket){
				$scope.selectBucket(bucketIndex);
				found = true;
				break;
			}
		}
		if (!found){
			console.log("Cannot find bucket named", bucket);
		}
	}

    $rootScope.$on('event:WorkflowCatalogService', function () {
        $scope.buckets = WorkflowCatalogService.getBuckets();
        if ($scope.selectedBucketIndex == -1){
        	$scope.selectBucket(0);
        }
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
