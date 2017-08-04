var nsCtrl = angular.module('wcp-rest', ['ngResource', 'spring-data-rest', 'angular-toArrayFilter', 'oitozero.ngSweetAlert', 'angular.filter']);

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

nsCtrl.factory('WorkflowCatalogService', function ($http, $interval, $rootScope, $state, $window, LoadingPropertiesService) {
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

    function deleteWorkflow(bucketIndex, name, callback) {
        var bucketId = buckets[bucketIndex].id;
        encodedName = unescape(encodeURIComponent(name));

        var url = localStorage['catalogServiceUrl'] + 'buckets/' + bucketId + '/resources/' + encodedName + "/";
        $http.delete(url)
            .success(function (response) {
                callback(true);
            })
            .error(function (response) {
                console.error("Error while querying catalog service on URL " + url + ":", response);
                callback(false);
            });
    }

    function addBucket(name, owner, callback) {
            alert("In the service the owner is: " + owner);

            var payload = new FormData();
            payload.append('name', name);
            if(owner != ""){
                payload.append('owner', owner);
            }

            var url = localStorage['catalogServiceUrl'] + 'buckets/';
            $http.post(url, payload)
                .success(function (response) {
                    callback(true);
                })
                .error(function (response) {
                    console.error("Error while querying catalog service on URL " + url + ":", response);
                    callback(false);
                });
        }

    function exportWorkflows(bucketIndex, selectedWorkflows) {
        if (selectedWorkflows.length > 0){
            var bucketId = buckets[bucketIndex].id;
            var names = "";
            
            for (var index = 0; index < selectedWorkflows.length; index++){
                if (index > 0){
                    names += ",";
                }
                
                var currentSelectedWorkflow = selectedWorkflows[index];
                var encodedName = unescape(encodeURIComponent(currentSelectedWorkflow.name));
                names += encodedName;
            }
    
            var path = localStorage['catalogServiceUrl'] + 'buckets/' + bucketId + '/resources?name=' + names;
            console.log(path)
            $window.location.assign(path);
        }
    }

    function importArchiveOfWorkflows(bucketIndex, file) {  
        var bucketId = buckets[bucketIndex].id;      
        var reader = new FileReader();
        reader.onloadend = function (e) {
            var data = e.target.result;
            var blob = new Blob([file], { type: "application/zip" });
            
            var payload = new FormData();
            payload.append('file', blob);
            payload.append('contentType', "application/xml");
            payload.append('kind', "workflow");
            payload.append('commitMessage', "Upload from ZIP archive");
            var url = localStorage['catalogServiceUrl'] + 'buckets/' + bucketId + '/resources';
            
            $http.post(url, payload)
                .error(function (response) {
                    console.error("Error while querying catalog service on URL " + url + ":", response);
                });
        }
        reader.readAsBinaryString(file);
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

    return {
        deleteWorkflow: function (bucketIndex, name, callback) {
            return deleteWorkflow(bucketIndex, name, callback);
        },
        doLogin: function (userName, userPass) {
            return doLogin(userName, userPass);
        },
        exportWorkflows: function (bucketIndex, workflows) {
            exportWorkflows(bucketIndex, workflows);
        },
        getBuckets: function () {
            return buckets;
        },
        getWorkflows: function (bucketIndex, callback) {
            queryWorkflows(bucketIndex, callback);
        },
        importArchiveOfWorkflows: function (bucketIndex, archive) {
            importArchiveOfWorkflows(bucketIndex, archive);
        },
        isConnected: function () {
            return getSessionId() != undefined;
        },
        startRegularWorkflowCatalogServiceQuery: function () {
            return startRegularWorkflowCatalogServiceQuery();
        },
        addBucket: function (name, owner, callback) {
            return addBucket(name, owner, callback);
        }
    };
});


// ---------- Controllers ----------

nsCtrl.controller('WorkflowCatalogController', function ($scope, $rootScope, $http, SpringDataRestAdapter, WorkflowCatalogService, schedulerGroupService) {

     $scope.schedulerGroupService = schedulerGroupService;
     $scope.schedulerGroupService.updateGroupList();

    $scope.selectedBucketIndex = 0;
    $scope.selectedWorkflows = [];
    var initURL = 'http://proactive-dashboard/workflow-catalog/buckets/'
    $scope.url = initURL;
    
    $scope.selectWorkflow = function(workflow, event){
        //Check whether the ctrl button is pressed
        if (event && (event.ctrlKey || event.metaKey)){
            //First check whether the workflow is already selected
            var index = getSelectedWorkflowIndex(workflow);
            //If selected, it's removed from the list ; otherwise, it is added
            if (index != -1)
                $scope.selectedWorkflows.splice(index, 1);
            else
                $scope.selectedWorkflows.push(workflow);
        }else{
            $scope.selectedWorkflows = [workflow];
        }
    }

    //

//        $scope.groups = function(){

//            var sessionid = getSessionId();
//
//            var userdata = $http.get(localStorage['schedulerRestUrl'] + 'logins/sessionid/' + sessionid + '/userdata/')
//
//            var userdataJson = JSON.parse(data);
//
//            var groupsList = userdataJson.groups;

//            var groupsList = ['group1', 'group2', 'group3'];

//            alert(groupsList);
//            groupsList.unshift("", "Lalala");

//            alert(groupsList);

//            return groupsList;

//            $scope.groups = groupsList;
//        }()

$scope.group_test = ["A","Something"]
console.log($scope.group_test);

    $scope.group_vals = [
       {
          group: ""
       },
       {
          group: "B"
       },
       {
          group: "C"
       },
       {
          group: "A"
       }
       ]
    
    function setURL(){
        $scope.url = initURL + $scope.buckets[$scope.selectedBucketIndex].name;
    }
    
    $scope.selectBucket = function(index){
        selectBucket(index);
    }
    
    function selectBucket(index){
        if (index >= 0 && index < $scope.buckets.length){
            if (index != $scope.selectedBucketIndex){
                $scope.selectedWorkflows = [];
                $scope.selectedBucketIndex = index;
            }
            setURL();
            
            WorkflowCatalogService.getWorkflows(index, function(workflows){
                $scope.workflows = workflows;

                for (var workflowIndex = 0; workflowIndex < workflows.length; workflowIndex++){
                    var workflow = workflows[workflowIndex];
                    //Init of the data stored into the object_key_values list
                    workflow.gis = [];
                    workflow.variables = [];
                    workflow.project_name = "";
                    workflow.icon = "/studio/images/about_115.png";
                    
                    for (var metadataIndex = 0; metadataIndex < workflow.object_key_values.length; metadataIndex++){
                        var label = workflow.object_key_values[metadataIndex].label;
                        var key = workflow.object_key_values[metadataIndex].key;
                        var value = workflow.object_key_values[metadataIndex].value;

                        if (label == "generic_information"){                            
                            if (key == "pca.action.icon"){
                                workflow.icon = value; 
                            }
                            workflow.gis.push({key: key, value: value});
                        }
                        
                        if (label == "variable"){
                            workflow.variables.push({key: key, value: value});
                        }
                        
                        if (label == "job_information" && key == "project_name"){
                            workflow.project_name = value;
                        }
                    }
                }
                
                if (workflows.length > 0 && $scope.selectedWorkflows.length == 0){
                    $scope.selectWorkflow(workflows[0]);
                }
            });
        }
    }
    
    $scope.getPanelStatus = function(workflow){
        if (getSelectedWorkflowIndex(workflow) != -1)
            return 'panel-selected';
        else
            return 'panel-default';
    }
    
    function getSelectedWorkflowIndex(workflow){
        for (var index = 0; index < $scope.selectedWorkflows.length; index++){
            if ($scope.selectedWorkflows[index].name == workflow.name){
                return index;
            }
        }
        return -1;
    }
    
    $scope.deleteSelectedWorkflows = function(){
        var notDeletedWorkflows = [];
        for (var index = 0; index < $scope.selectedWorkflows.length; index++){
            var currentSelectedWorkflow = $scope.selectedWorkflows[index];
            WorkflowCatalogService.deleteWorkflow($scope.selectedBucketIndex, currentSelectedWorkflow.name,
                function(success){
                    if (!success){
                        console.log("Error deleting workflow name", currentSelectedWorkflow.name)
                        notDeletedWorkflows.push(currentSelectedWorkflow);
                    }
                }
            );
        }
        $scope.selectedWorkflows = notDeletedWorkflows;
        updateBucketWorkflows();        
    }
    
    $scope.exportSelectedWorkflows = function(){
        WorkflowCatalogService.exportWorkflows($scope.selectedBucketIndex, $scope.selectedWorkflows);
    }

     $scope.addBucket = function(){
        var bucketName = document.getElementById('bucketName').value;
//        var bucketOwner = $scope.selectedGroup.group;
        var bucketOwner = $scope.selectedGroup;

        WorkflowCatalogService.addBucket(bucketName, bucketOwner,
            function(success){
                if (!success){
                    console.log("Error adding the new bucket", bucketName);
                }
            }
        );
     }

    $scope.uploadArchiveOfWorkflows = function(){
        var file = document.getElementById('zipArchiveInput').files[0];
        WorkflowCatalogService.importArchiveOfWorkflows($scope.selectedBucketIndex, file);
    }
    
    function updateBucketWorkflows(){
        selectBucket($scope.selectedBucketIndex);
    }

    $rootScope.$on('event:WorkflowCatalogService', function () {
        $scope.buckets = WorkflowCatalogService.getBuckets();
        updateBucketWorkflows();
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
