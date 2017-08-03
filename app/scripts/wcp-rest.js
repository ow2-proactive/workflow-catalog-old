var nsCtrl = angular.module('wcp-rest', ['ngResource', 'spring-data-rest', 'angular-toArrayFilter', 'oitozero.ngSweetAlert', 'angular.filter']);

function getSessionId() {
    return localStorage['pa.session'];
}

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
    var queryWorkflowCatalogServiceTimer;

    function compareWorkflowsList(workflowsList1, workflowsList2){
        if (!workflowsList1 || !workflowsList2){
            return false;
        }
        
        if (workflowsList1.length != workflowsList2.length){
            return false;
        }
        
        for (var index = 0; index < workflowsList1.length; index++){
            var workflow1 = workflowsList1[index];
            var workflow2 = workflowsList2[index];
            
            if (workflow1.commit_time_raw != workflow2.commit_time_raw){
                return false;
            }
        }
        
        return true;
    }
    
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

    function exportWorkflows(bucketIndex, selectedWorkflows) {
        if (selectedWorkflows.length > 0){
            var bucketId = buckets[bucketIndex].id;
            var names = "";
            
            for (var index = 0; index < selectedWorkflows.length; index++){
                if (index > 0){
                    names += ",";
                }
                
                var currentSelectedWorkflowName = selectedWorkflows[index];
                var encodedName = unescape(encodeURIComponent(currentSelectedWorkflowName));
                names += encodedName;
            }
    
            var path = localStorage['catalogServiceUrl'] + 'buckets/' + bucketId + '/resources?name=' + names;
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

    function queryWorkflowRevisions(bucketIndex, workflowName, callback) {
        var bucketId = buckets[bucketIndex].id;
        var url = localStorage['catalogServiceUrl'] + 'buckets/' + bucketId + '/resources/' + workflowName + '/revisions';
        $http.get(url)
            .success(function (response) {
                callback(response);
            })
            .error(function (response) {
                console.error("Error while querying catalog service on URL " + url + ":", response);
            });
    }

    function restoreRevision(bucketIndex, workflowName, revisionCommitTime) {
        var bucketId = buckets[bucketIndex].id;
        var url = localStorage['catalogServiceUrl'] + 'buckets/' + bucketId + '/resources/' + workflowName + '/?commitTime=' + revisionCommitTime;
        $http.put(url)
            .success(function (response) {
                console.log("Revision successfully restored");
            })
            .error(function (response) {
                console.error("Error while querying catalog service on URL " + url + ":", response);
            });
    }
    
    function setWorkflowsData(workflows){
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
    }

    return {
        compareWorkflowsList: function(workflowsList1, workflowsList2){
            return compareWorkflowsList(workflowsList1, workflowsList2);
        },
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
        getWorkflowRevisions: function (bucketIndex, workflowName, callback) {
            queryWorkflowRevisions(bucketIndex, workflowName, callback);
        },
        importArchiveOfWorkflows: function (bucketIndex, archive) {
            importArchiveOfWorkflows(bucketIndex, archive);
        },
        isConnected: function () {
            return getSessionId() != undefined;
        },
        restoreRevision: function (bucketId, workflowName, revisionCommitTime) {
            return restoreRevision(bucketId, workflowName, revisionCommitTime);
        },setWorkflowsData: function(workflows){
            setWorkflowsData(workflows);
        },
        startRegularWorkflowCatalogServiceQuery: function () {
            return startRegularWorkflowCatalogServiceQuery();
        }
    };
});


// ---------- Controllers ----------

nsCtrl.controller('WorkflowCatalogController', function ($scope, $rootScope, $http, $location, SpringDataRestAdapter, WorkflowCatalogService) {
    
    $scope.selectedBucketIndex = 0;
    //The list of workflow names that have been selected
    $scope.selectedWorkflows = [];
    // The index of the selected revision
    $scope.selectedRevisionIndex = 0;
    // The list of revisions of the displayed workflow
    $scope.lastSelectedWorkflowRevisions = [];
    // lastSelectedWorkflow is the last workflow that has been selected (so the displayed one on the right)
    $scope.lastSelectedWorkflow = null;
    
    $scope.selectWorkflow = function(workflowName, event){
        //Check whether the ctrl button is pressed
        if (event && (event.ctrlKey || event.metaKey)){
            //First check whether the workflow is already selected
            var index = getSelectedWorkflowIndex(workflowName);
            //If selected, it's removed from the list ; otherwise, it is added
            if (index != -1){
                if ($scope.selectedWorkflows.length > 1){
                    $scope.selectedWorkflows.splice(index, 1);
                }
            }
            else {
                $scope.selectedWorkflows.push(workflowName);
            }
        }else{
            $scope.selectedWorkflows = [workflowName];
        }
        updateLastSelectedWorkflow();
    }
    
    // This function updates the var lastSelectedWorkflow which is the displayed workflow on the right panel
    function updateLastSelectedWorkflow(){
        var length = $scope.selectedWorkflows.length;
        $scope.lastSelectedWorkflow = null;
        if (length > 0){
            // The last selected workflow is the last item in the list of selected workflows
            var lastSelectedWorkflowName = $scope.selectedWorkflows[length - 1];
            //Then we retrieve the corresponding workflow in the list of workflows and assign it to the variable lastSelectedWorkflow
            for (var index = 0; index < $scope.workflows.length; index++){
                var currentWorkflow = $scope.workflows[index]
                if (currentWorkflow.name == lastSelectedWorkflowName){
                    $scope.lastSelectedWorkflow = currentWorkflow;
                }
            }
        }
    }
    
    $scope.selectRevision = function(index){
        $scope.selectedRevisionIndex = index;
    }
    
    $scope.selectBucket = function(index){
        selectBucket(index);
    }
    
    $scope.updateRevisionsList = function(){
        $scope.lastSelectedWorkflowRevisions = [];
        var selectedWorkflowName = $scope.lastSelectedWorkflow.name;
        WorkflowCatalogService.getWorkflowRevisions($scope.selectedBucketIndex, selectedWorkflowName, function(revisions){
            $scope.lastSelectedWorkflowRevisions = revisions;
        });
    }
    
    function selectBucket(index){
        if (index >= 0 && index < $scope.buckets.length){
            if (index != $scope.selectedBucketIndex){
                $scope.selectedWorkflows = [];
                $scope.selectedBucketIndex = index;
            }
            
            WorkflowCatalogService.getWorkflows(index, function(workflows){
                if (!WorkflowCatalogService.compareWorkflowsList($scope.workflows, workflows)){
                    $scope.workflows = workflows;
                    updateLastSelectedWorkflow();
    
                    WorkflowCatalogService.setWorkflowsData(workflows);
                    
                    if (workflows.length > 0 && $scope.selectedWorkflows.length == 0){
                        $scope.selectWorkflow(workflows[0].name);
                    }
                }
            });
        }
    }
    
    $scope.getPanelStatus = function(workflow){
        if (getSelectedWorkflowIndex(workflow.name) != -1)
            return 'panel-selected';
        else
            return 'panel-default';
    }
    
    function getSelectedWorkflowIndex(workflowName){
        for (var index = 0; index < $scope.selectedWorkflows.length; index++){
            if ($scope.selectedWorkflows[index] == workflowName){
                return index;
            }
        }
        return -1;
    }
    
    $scope.deleteSelectedWorkflows = function(){
        var workflowsToDelete = $scope.selectedWorkflows;
        $scope.selectedWorkflows = [];
        updateLastSelectedWorkflow();
        var notDeletedWorkflows = [];
        for (var index = 0; index < workflowsToDelete.length; index++){
            var currentSelectedWorkflow = workflowsToDelete[index];
            WorkflowCatalogService.deleteWorkflow($scope.selectedBucketIndex, currentSelectedWorkflow,
                function(success){
                    if (!success){
                        console.log("Error deleting workflow name", currentSelectedWorkflow)
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
    
    $scope.uploadArchiveOfWorkflows = function(){
        var file = document.getElementById('zipArchiveInput').files[0];
        WorkflowCatalogService.importArchiveOfWorkflows($scope.selectedBucketIndex, file);
    }
    
    $scope.restoreRevision = function(){
        var selectedRevision = $scope.lastSelectedWorkflowRevisions[$scope.selectedRevisionIndex];
        WorkflowCatalogService.restoreRevision($scope.selectedBucketIndex, selectedRevision.name, selectedRevision.commit_time_raw);
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
                    $state.go('index.workflow_catalog');

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
