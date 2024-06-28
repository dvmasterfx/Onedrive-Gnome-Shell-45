/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This extension is ported to gnome 45 from Onedrive Ressurect Extension
 * This extension is a fork from  Onedrive Ressurect from diegstroyer https://github.com/diegstroyer/oneDrive
 * This extension is not affiliated, funded, or in any way associated with Microsoft and OneDrive software.
 */

import GObject from 'gi://GObject';

import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import GLib from 'gi://GLib';

import Gio from 'gi://Gio';

const Indicator = GObject.registerClass(

class Indicator extends PanelMenu.Button {

    _init() {

        super._init(0.0, _('OneDrive'));

        this.statusIcon = new St.Icon({

            icon_name: '',

            style_class: 'disabledIcon',

        });

        let box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });

        box.add_child(this.statusIcon);

        this.add_child(box);

        let menuItemOnOff = new PopupMenu.PopupSwitchMenuItem("OneDrive", this.isOneDriveActive());

        this.menu.addMenuItem(menuItemOnOff);

        menuItemOnOff.statusAreaKey = "OneDrive";

        menuItemOnOff.connect('toggled', this.onOff.bind(this));

        this.menuItemOnOff = menuItemOnOff;

        let itemLogin = new PopupMenu.PopupMenuItem(_('Login...'));

        itemLogin.connect('activate', () => {

            if(this.menuItemOnOff._switch.state)
            {
                this.menuItemOnOff.setToggleState(false);

                this.onOff().bind(this);

            }
            else
            {
                let loginapp = Gio.AppInfo.create_from_commandline("onedrive",

                    null,

                    Gio.AppInfoCreateFlags.SUPPORTS_STARTUP_NOTIFICATION |

                    Gio.AppInfoCreateFlags.NEEDS_TERMINAL);

                    loginapp.launch([], global.create_app_launch_context(0, -1));

                this.menuItemOnOff.setToggleState(true);

                this.onOff().bind(this);

            }

        });

        this.menu.addMenuItem(itemLogin);

        this.itemLogin = itemLogin;

        let itemStatus = new PopupMenu.PopupMenuItem(_('Show service status'));

        let app = Gio.AppInfo.create_from_commandline(

            "systemctl --user status onedrive",

            null,

            Gio.AppInfoCreateFlags.SUPPORTS_STARTUP_NOTIFICATION |

            Gio.AppInfoCreateFlags.NEEDS_TERMINAL);

        itemStatus.connect('activate', () => {

            app.launch([], global.create_app_launch_context(0, -1));

        });

        this.menu.addMenuItem(itemStatus);

        let itemProcess = new PopupMenu.PopupMenuItem(_('Show service process'));

        let procapp = Gio.AppInfo.create_from_commandline(

            "journalctl --user-unit=onedrive -f",

            null,

            Gio.AppInfoCreateFlags.SUPPORTS_STARTUP_NOTIFICATION

            |Gio.AppInfoCreateFlags.NEEDS_TERMINAL);

        itemProcess.connect('activate', () => {

            procapp.launch([], global.create_app_launch_context(0, -1));

        });

        this.menu.addMenuItem(itemProcess);

        let itemWeb = new PopupMenu.PopupMenuItem(_('Open OneDrive web site'));

        itemWeb.connect('activate', () => {

            Gio.AppInfo.launch_default_for_uri('https://onedrive.live.com/', null);

        });

        this.menu.addMenuItem(itemWeb);

        let itemFolder = new PopupMenu.PopupMenuItem(_('Open OneDrive local folder'));

        itemFolder.connect('activate', () => {

            this.setOneDriveFolder();

            if(this._folder === "") Main.notify("OneDrive 'sync-dir' not found");

            else Gio.AppInfo.launch_default_for_uri("file://" + this._folder, null);

        });

        this.menu.addMenuItem(itemFolder);

        // requirement check
        let problem = false;

        if(!problem && !this.controllaBinario("onedrive")) problem = true;

        if(!problem && !this.controllaBinario("systemctl")) problem = true;

        if(!problem && !this.controllaBinario("journalctl")) problem = true;

        if(!problem && !this.controllaBinario("touch")) problem = true;

        if(problem) return;

        // start loop
        this.setOneDriveFolder();

        this.lastLineStatus = "";

        this._aggiornaLoop = GLib.timeout_add(4,3000, this.aggiorna.bind(this));

    }

    setOneDriveFolder()

    {
        let [resOnedrive, oneDriveConfig] = GLib.spawn_command_line_sync('onedrive --display-config');

        let folder = "";

        let config = oneDriveConfig.toString().split("\n");

        for(let cont=0;cont<config.length;cont++)
        {
            if(config[cont].indexOf("sync_dir") >= 0)
            {
                folder = (config[cont].split("=")[1]).trim();

                break;

            }

        }

        this._folder = folder;
    }

    controllaBinario(bin)
    {
        if(GLib.find_program_in_path(bin) === null)
        {
            Main.notify("I can't find program '" + bin + "'. This extention will not work!");

            return false;

        }

        return true;
    }

    aggiorna() {

        if(this.isOneDriveActive())
        {
            let oldlastLineStatus = this.lastLineStatus;

            this.getLastLineStatus();

            if(oldlastLineStatus !== this.lastLineStatus

                || (this.lastLineStatus.indexOf("Downloading") >= 0 && this.lastLineStatus.indexOf("done.") === -1)

                || (this.lastLineStatus.indexOf("Uploading") >= 0 && this.lastLineStatus.indexOf("done.") === -1))

            {
                this.statusIcon.set_property("style_class", "workingIcon");

                this.statusIcon.set_property("icon_name", "system-search-symbolic");

                this.statusIcon.set_property("icon_name", "");

                this.setEmblem("synchronizing");

            }

            else
            {
                this.statusIcon.set_property("style_class", "activeIcon");

                this.statusIcon.set_property("icon_name", "system-search-symbolic");

                this.statusIcon.set_property("icon_name", "");

                this.menuItemOnOff.setToggleState(true);

                this.itemLogin.label.text = _('Logout...');

                this.setEmblem("default");
            }

        }

        else
        {
            this.statusIcon.set_property("style_class", "disabledIcon");

            this.statusIcon.set_property("icon_name", "system-search-symbolic");

            this.statusIcon.set_property("icon_name", "");

            this.menuItemOnOff.setToggleState(false);

            this.itemLogin.label.text = _('Login...');

            this.setEmblem();

        }

        return true;
    }

    setEmblem(state)
    {
        let priority = GLib.PRIORITY_DEFAULT;

        let cancellable = new Gio.Cancellable();

        let flags = Gio.FileQueryInfoFlags.NONE;


        let file = Gio.File.new_for_path(this._folder);

        file.query_info_async('metadata::emblems', flags, priority, cancellable, (file, res) => {

            let info = file.query_info_finish(res);

            if(state === undefined) info.set_attribute_stringv('metadata::emblems', []);

            else info.set_attribute_stringv('metadata::emblems', [state]);

            file.set_attributes_async(info, flags, priority, cancellable, (file, res) => {

                file.set_attributes_finish(res);

                GLib.spawn_command_line_async("touch " + this._folder);

            });

        });

    }

    isOneDriveActive() {

        let [resOnedrive, outOnedrive] = GLib.spawn_command_line_sync("systemctl --user is-active onedrive");

        let outOnedriveString = outOnedrive.toString().replace(/(\r\n|\n|\r)/gm,"");

        return outOnedriveString == "active";

    }

    getLastLineStatus() {

        let [resOnedrive, outOnedrive] = GLib.spawn_command_line_sync("systemctl --user status onedrive");

        let status = outOnedrive.toString().split("\n");

        this.lastLineStatus = status[status.length -2];
    }

    onOff() {

        let result = this.isOneDriveActive();

        if(result) {

            let [resOnedrive, outOnedrive] = GLib.spawn_command_line_sync("systemctl --user stop onedrive");

        }

        else {

            let [resOnedrive, outOnedrive] = GLib.spawn_command_line_sync("systemctl --user start onedrive");

        }

        this.aggiorna();

    }

});

export default class OnedriveExtension extends Extension {

    constructor(uuid) {

        super(uuid);

    }

    enable() {

        this._indicator = new Indicator();

        Main.panel.addToStatusArea(this._uuid, this._indicator);

    }

    disable() {

        GLib.source_remove(this._indicator._aggiornaLoop);

        this._indicator.setEmblem();

        this._indicator.destroy();

        this._indicator = null;

    }

}
