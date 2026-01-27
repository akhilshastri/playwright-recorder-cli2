const { GridComponent } = require('./grid');
const { TableComponent } = require('./table');
const { DropdownComponent } = require('./dropdown');
const { ModalComponent } = require('./modal');
const { FormComponent } = require('./form');
const { TabsComponent } = require('./tabs');
const { AccordionComponent } = require('./accordion');
const { PaginationComponent } = require('./pagination');
const { TreeComponent } = require('./tree');

const COMPONENTS = [
  GridComponent,
  TableComponent,
  DropdownComponent,
  ModalComponent,
  FormComponent,
  TabsComponent,
  AccordionComponent,
  PaginationComponent,
  TreeComponent,
];

function detectComponent(element) {
  for (const ComponentClass of COMPONENTS) {
    if (ComponentClass.detect(element)) {
      return new ComponentClass(element);
    }
  }
  return null;
}

module.exports = {
  detectComponent,
  COMPONENTS,
  GridComponent,
  TableComponent,
  DropdownComponent,
  ModalComponent,
  FormComponent,
  TabsComponent,
  AccordionComponent,
  PaginationComponent,
  TreeComponent,
};
