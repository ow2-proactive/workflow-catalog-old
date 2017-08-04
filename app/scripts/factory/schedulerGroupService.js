var wcpRestModule = angular.module('wcp-rest');

wcpRestModule.factory('schedulerGroupService', function ($http, catalogRestService) {

    var defaultNoGroup = "-no group-";
    var groupPrefix = "GROUP:";
    var data = { groups : [defaultNoGroup],
                   selectedGroup: defaultNoGroup};

    function updateGroupList() {
                catalogRestService.getUserData(function (response) {
                             var groupsList = response.groups;
                             groupsList.unshift(defaultNoGroup);
                             data.groups = groupsList;
                        });
    }

    return {
            updateGroupList: function () {
                return updateGroupList();
            },
            data: data,
            defaultNoGroup: defaultNoGroup,
            groupPrefix: groupPrefix
        };
});
